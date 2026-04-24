-- =====================================================================
-- 013_pedido_a_gasto — Pedidos marcados como pagados generan gasto
-- =====================================================================
-- Cuando un pedido a proveedor pasa a estado_pago='pagado', se crea
-- automáticamente una fila en `gastos` bajo la categoría "Mercancía"
-- con distribucion='orvann' (la caja del negocio absorbe la compra).
-- El usuario puede editar el gasto después si el pago real fue de un
-- socio en particular (cambiar pagador + distribucion).
--
-- Columna nueva `gastos.ref_pedido_id` para trazabilidad bidireccional.
-- on delete set null: si el pedido se borra, el gasto queda huérfano
-- (no se borra) para no perder registro financiero.
-- =====================================================================

alter table gastos
  add column if not exists ref_pedido_id uuid references pedidos_proveedor(id) on delete set null;

create index if not exists idx_gastos_ref_pedido
  on gastos(ref_pedido_id)
  where ref_pedido_id is not null;

create or replace function fn_crear_gasto_de_pedido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cat_mercancia uuid;
  v_nombre_proveedor text;
begin
  -- Solo dispara cuando estado_pago cambia A 'pagado' (idempotente en re-saves)
  if not (tg_op = 'UPDATE'
    and (old.estado_pago is distinct from 'pagado')
    and new.estado_pago = 'pagado') then
    return new;
  end if;

  -- Evitar duplicados si ya existe un gasto ligado a este pedido
  if exists (select 1 from gastos where ref_pedido_id = new.id) then
    return new;
  end if;

  select id into v_cat_mercancia
    from categorias_gasto
    where lower(nombre) = 'mercancía' or lower(nombre) = 'mercancia'
    limit 1;

  if v_cat_mercancia is null then
    raise notice 'Categoria Mercancia no encontrada; no se crea gasto automatico para pedido %', new.id;
    return new;
  end if;

  select nombre into v_nombre_proveedor
    from proveedores where id = new.proveedor_id;

  insert into gastos (
    fecha,
    categoria_id,
    descripcion,
    monto_total,
    metodo_pago,
    pagador,
    distribucion,
    ref_pedido_id,
    notas
  ) values (
    coalesce(new.fecha_pago, current_date),
    v_cat_mercancia,
    'Pedido proveedor'
      || coalesce(' · ' || v_nombre_proveedor, '')
      || ' · ' || to_char(new.fecha_pedido, 'YYYY-MM-DD'),
    coalesce(new.total, 0),
    'efectivo',  -- placeholder; el usuario edita si el método real fue otro
    'ORVANN',
    'orvann',
    new.id,
    'Creado automaticamente al marcar pedido como pagado. Editar pagador/metodo si hace falta.'
  );

  return new;
end;
$$;

drop trigger if exists tg_crear_gasto_de_pedido on pedidos_proveedor;
create trigger tg_crear_gasto_de_pedido
  after update on pedidos_proveedor
  for each row
  execute function fn_crear_gasto_de_pedido();

grant execute on function fn_crear_gasto_de_pedido() to authenticated, service_role;
