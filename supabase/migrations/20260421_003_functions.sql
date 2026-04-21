-- =====================================================================
-- 003_functions — Funciones de negocio (usadas por triggers del 004)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_actualizar_stock_cache
-- Recalcula variantes.stock_cache = SUM(movimientos.cantidad) tras
-- cualquier cambio en movimientos_inventario.
-- ---------------------------------------------------------------------
create or replace function fn_actualizar_stock_cache()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.variante_id, old.variante_id);
  update variantes
     set stock_cache = coalesce(
       (select sum(cantidad) from movimientos_inventario where variante_id = v_id),
       0
     ),
     updated_at = now()
   where id = v_id;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_post_venta_item
-- Emite movimiento de inventario con signo según tipo_transaccion de la
-- venta padre. venta/cambio → negativo (tipo=venta). devolucion →
-- positivo (tipo=anulacion_venta).
-- ---------------------------------------------------------------------
create or replace function fn_post_venta_item()
returns trigger
language plpgsql
as $$
declare
  v_tipo_tx   tipo_transaccion;
  v_vendedor  uuid;
  v_signo     int;
  v_tipo_mov  tipo_movimiento;
  v_ref_tipo  text;
begin
  if (tg_op = 'DELETE') then
    delete from movimientos_inventario
      where referencia_id = old.venta_id
        and variante_id = old.variante_id
        and referencia_tipo in ('venta', 'devolucion', 'cambio');
    return old;
  end if;

  select tipo_transaccion, vendedor_id
    into v_tipo_tx, v_vendedor
    from ventas where id = new.venta_id;

  if v_tipo_tx = 'devolucion' then
    v_signo    := 1;
    v_tipo_mov := 'anulacion_venta';
    v_ref_tipo := 'devolucion';
  else
    -- 'venta' y 'cambio' (el item nuevo del cambio sale como venta)
    v_signo    := -1;
    v_tipo_mov := 'venta';
    v_ref_tipo := v_tipo_tx::text;
  end if;

  if (tg_op = 'INSERT') then
    insert into movimientos_inventario (
      variante_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id
    ) values (
      new.variante_id, v_tipo_mov, v_signo * new.cantidad,
      v_ref_tipo, new.venta_id, v_vendedor
    );
  elsif (tg_op = 'UPDATE') then
    -- Si cambió variante o cantidad, reescribir el movimiento
    delete from movimientos_inventario
      where referencia_id = old.venta_id
        and variante_id = old.variante_id
        and referencia_tipo in ('venta', 'devolucion', 'cambio');
    insert into movimientos_inventario (
      variante_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id
    ) values (
      new.variante_id, v_tipo_mov, v_signo * new.cantidad,
      v_ref_tipo, new.venta_id, v_vendedor
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_post_recepcion_pedido
-- Cuando pedidos_proveedor.fecha_recepcion pasa de NULL a date,
-- emite entrada_pedido por cada item con variante_id.
-- ---------------------------------------------------------------------
create or replace function fn_post_recepcion_pedido()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE'
      and old.fecha_recepcion is null
      and new.fecha_recepcion is not null) then
    insert into movimientos_inventario (
      variante_id, tipo, cantidad, referencia_tipo, referencia_id, notas
    )
    select
      ppi.variante_id,
      'entrada_pedido',
      ppi.unidades,
      'pedido',
      new.id,
      'Recepción pedido ' || new.id
    from pedidos_proveedor_items ppi
    where ppi.pedido_id = new.id
      and ppi.variante_id is not null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_post_transformacion
-- Al insertar una transformación, emite 2 movimientos (out + in).
-- ---------------------------------------------------------------------
create or replace function fn_post_transformacion()
returns trigger
language plpgsql
as $$
begin
  insert into movimientos_inventario (
    variante_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id
  ) values (
    new.variante_origen_id, 'transformacion_out', -new.cantidad,
    'transformacion', new.id, new.usuario_id
  );
  insert into movimientos_inventario (
    variante_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id
  ) values (
    new.variante_destino_id, 'transformacion_in', new.cantidad,
    'transformacion', new.id, new.usuario_id
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_calcular_distribucion_gasto
-- BEFORE INSERT/UPDATE en gastos: llena montos por socio según
-- distribucion. El check constraint chk_suma_gasto valida la suma.
-- ---------------------------------------------------------------------
create or replace function fn_calcular_distribucion_gasto()
returns trigger
language plpgsql
as $$
declare
  v_tercio  numeric(14,2);
  v_resto   numeric(14,2);
begin
  if new.distribucion = 'equitativa' then
    v_tercio := round(new.monto_total / 3, 2);
    v_resto  := new.monto_total - (v_tercio * 3);
    new.monto_kathe  := v_tercio;
    new.monto_andres := v_tercio;
    new.monto_jp     := v_tercio + v_resto;  -- el resto (±1 centavo) se asigna a JP
    new.monto_orvann := 0;
  elsif new.distribucion = 'asignada' then
    new.monto_kathe  := case when new.pagador = 'KATHE'  then new.monto_total else 0 end;
    new.monto_andres := case when new.pagador = 'ANDRES' then new.monto_total else 0 end;
    new.monto_jp     := case when new.pagador = 'JP'     then new.monto_total else 0 end;
    new.monto_orvann := case when new.pagador = 'ORVANN' then new.monto_total else 0 end;
  elsif new.distribucion = 'orvann' then
    new.monto_kathe  := 0;
    new.monto_andres := 0;
    new.monto_jp     := 0;
    new.monto_orvann := new.monto_total;
  end if;
  -- 'custom': se respetan los montos enviados; el check valida la suma.
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_actualizar_totales_venta
-- Recalcula ventas.subtotal = sum(venta_items.subtotal) y
-- ventas.total = subtotal - descuento_monto. Para devoluciones los
-- valores quedan positivos en BD; el signo contable lo aplica el
-- consumidor según ventas.tipo_transaccion.
-- ---------------------------------------------------------------------
create or replace function fn_actualizar_totales_venta()
returns trigger
language plpgsql
as $$
declare
  v_venta_id uuid;
  v_subtotal numeric(14,2);
  v_desc     numeric(14,2);
begin
  v_venta_id := coalesce(new.venta_id, old.venta_id);
  select coalesce(sum(subtotal), 0) into v_subtotal
    from venta_items where venta_id = v_venta_id;
  select coalesce(descuento_monto, 0) into v_desc
    from ventas where id = v_venta_id;
  update ventas
     set subtotal = v_subtotal,
         total    = greatest(v_subtotal - v_desc, 0)
   where id = v_venta_id;
  return coalesce(new, old);
end;
$$;

-- Variante BEFORE UPDATE en ventas para cuando cambia el descuento:
create or replace function fn_aplicar_descuento_venta()
returns trigger
language plpgsql
as $$
begin
  new.total := greatest(coalesce(new.subtotal, 0) - coalesce(new.descuento_monto, 0), 0);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_actualizar_cierre_caja
-- Upsert en cierres_caja del día correspondiente tras cambios en
-- ventas, gastos o consignaciones. Recalcula desde cero los agregados
-- del día para evitar drift.
-- ---------------------------------------------------------------------
create or replace function fn_actualizar_cierre_caja()
returns trigger
language plpgsql
as $$
declare
  v_fecha date;
begin
  -- Detectar la fecha afectada según la tabla
  if tg_table_name = 'ventas' then
    v_fecha := coalesce((new).fecha::date, (old).fecha::date);
  elsif tg_table_name = 'gastos' then
    v_fecha := coalesce((new).fecha, (old).fecha);
  elsif tg_table_name = 'consignaciones' then
    v_fecha := coalesce((new).fecha, (old).fecha);
  else
    return coalesce(new, old);
  end if;

  -- Crear la fila del día si no existe
  insert into cierres_caja (fecha) values (v_fecha)
    on conflict (fecha) do nothing;

  -- Recalcular agregados
  update cierres_caja c set
    ventas_efectivo = coalesce((
      select sum(vp.monto) from ventas v
      join venta_pagos vp on vp.venta_id = v.id
      where v.fecha::date = c.fecha
        and vp.metodo = 'efectivo'
        and v.estado = 'completada'
        and v.tipo_transaccion = 'venta'
    ), 0),
    ventas_datafono = coalesce((
      select sum(vp.monto) from ventas v
      join venta_pagos vp on vp.venta_id = v.id
      where v.fecha::date = c.fecha
        and vp.metodo = 'datafono'
        and v.estado = 'completada'
        and v.tipo_transaccion = 'venta'
    ), 0),
    ventas_transferencia = coalesce((
      select sum(vp.monto) from ventas v
      join venta_pagos vp on vp.venta_id = v.id
      where v.fecha::date = c.fecha
        and vp.metodo = 'transferencia'
        and v.estado = 'completada'
        and v.tipo_transaccion = 'venta'
    ), 0),
    ventas_credito = coalesce((
      select sum(vp.monto) from ventas v
      join venta_pagos vp on vp.venta_id = v.id
      where v.fecha::date = c.fecha
        and vp.metodo = 'credito'
        and v.estado = 'completada'
        and v.tipo_transaccion = 'venta'
    ), 0),
    ventas_plan_separe = coalesce((
      select sum(vp.monto) from ventas v
      join venta_pagos vp on vp.venta_id = v.id
      where v.fecha::date = c.fecha
        and vp.metodo = 'plan_separe'
        and v.estado = 'completada'
        and v.tipo_transaccion = 'venta'
    ), 0),
    gastos_efectivo = coalesce((
      select sum(g.monto_total) from gastos g
      where g.fecha = c.fecha
        and g.metodo_pago = 'efectivo'
        and g.pagador = 'ORVANN'
    ), 0),
    consignaciones_salida = coalesce((
      select sum(cs.monto) from consignaciones cs
      where cs.fecha = c.fecha
        and cs.origen = 'caja_tienda'
    ), 0),
    updated_at = now()
   where c.fecha = v_fecha;

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_actualizar_cache_cliente
-- Al completarse una venta con cliente, actualiza caches del cliente.
-- ---------------------------------------------------------------------
create or replace function fn_actualizar_cache_cliente()
returns trigger
language plpgsql
as $$
declare
  v_cliente uuid;
begin
  v_cliente := coalesce(new.cliente_id, old.cliente_id);
  if v_cliente is null then
    return coalesce(new, old);
  end if;

  update clientes set
    total_comprado_cache = coalesce((
      select sum(case when tipo_transaccion = 'devolucion' then -total else total end)
        from ventas
        where cliente_id = v_cliente and estado = 'completada'
    ), 0),
    num_compras_cache = coalesce((
      select count(*) from ventas
        where cliente_id = v_cliente
          and estado = 'completada'
          and tipo_transaccion = 'venta'
    ), 0),
    primera_compra_fecha = coalesce(primera_compra_fecha, (
      select min(fecha::date) from ventas
        where cliente_id = v_cliente
          and estado = 'completada'
          and tipo_transaccion = 'venta'
    ))
   where id = v_cliente;

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_generar_sku(producto_id, color, talla, diseno_id) → text
-- Patrón {PRODUCTO3}-{COLOR3}-{TALLA}[-{DISENO4}]. Sufijo -2, -3 si
-- colisiona. Unaccent en memoria (sin extensión).
-- ---------------------------------------------------------------------
create or replace function fn_sku_slug(txt text, n int)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if txt is null or length(trim(txt)) = 0 then
    return null;
  end if;
  -- Normalización básica: uppercase + eliminar acentos comunes + solo A-Z0-9
  s := upper(txt);
  s := translate(s,
    'ÁÉÍÓÚÄËÏÖÜÀÈÌÒÙÂÊÎÔÛÑÇ',
    'AEIOUAEIOUAEIOUAEIOUNC');
  s := regexp_replace(s, '[^A-Z0-9]', '', 'g');
  if length(s) = 0 then
    return null;
  end if;
  return substr(s, 1, n);
end;
$$;

create or replace function fn_generar_sku(
  p_producto_id uuid,
  p_color       text,
  p_talla       text,
  p_diseno_id   uuid
) returns text
language plpgsql
as $$
declare
  v_prod   text;
  v_col    text;
  v_tal    text;
  v_dis    text;
  v_base   text;
  v_try    text;
  v_i      int := 1;
begin
  select fn_sku_slug(nombre, 3) into v_prod from productos where id = p_producto_id;
  v_col := coalesce(fn_sku_slug(p_color, 3), '');
  v_tal := coalesce(fn_sku_slug(p_talla, 4), '');
  if p_diseno_id is not null then
    select fn_sku_slug(nombre, 4) into v_dis from disenos where id = p_diseno_id;
  end if;

  v_base := concat_ws('-',
    nullif(v_prod, ''),
    nullif(v_col,  ''),
    nullif(v_tal,  ''),
    nullif(v_dis,  '')
  );

  if v_base is null or length(v_base) = 0 then
    v_base := 'SKU';
  end if;

  v_try := v_base;
  while exists (select 1 from variantes where sku = v_try) loop
    v_i := v_i + 1;
    v_try := v_base || '-' || v_i::text;
  end loop;

  return v_try;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_validar_pagos_venta
-- Al cambiar venta_pagos, verifica que la suma iguale ventas.total
-- (tolerancia ±1) SÓLO si la venta está en estado completada. Esto
-- permite inserts incrementales antes de marcar la venta completa.
-- ---------------------------------------------------------------------
create or replace function fn_validar_pagos_venta()
returns trigger
language plpgsql
as $$
declare
  v_venta_id uuid;
  v_estado   estado_venta;
  v_total    numeric(14,2);
  v_suma     numeric(14,2);
begin
  v_venta_id := coalesce(new.venta_id, old.venta_id);
  select estado, total into v_estado, v_total
    from ventas where id = v_venta_id;
  if v_estado <> 'completada' then
    return coalesce(new, old);
  end if;
  select coalesce(sum(monto), 0) into v_suma
    from venta_pagos where venta_id = v_venta_id;
  if abs(v_suma - v_total) > 1 then
    raise exception 'Suma de pagos (%) no cuadra con total de venta (%). Diferencia: %',
      v_suma, v_total, (v_suma - v_total);
  end if;
  return coalesce(new, old);
end;
$$;
