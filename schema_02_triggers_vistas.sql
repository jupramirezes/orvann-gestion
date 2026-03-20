-- ============================================================
-- ORVANN Schema — PARTE 2: Triggers + Vistas
-- Ejecutar DESPUÉS de que el frontend esté conectado y probado
-- ============================================================

-- Auto-descuento de stock al registrar item de venta
create or replace function fn_venta_descuenta_stock()
returns trigger as $$
declare
  v_stock_actual int;
begin
  select stock into v_stock_actual from variantes where id = NEW.variante_id for update;
  
  if v_stock_actual < NEW.cantidad then
    raise exception 'Stock insuficiente para variante %. Stock: %, Solicitado: %', NEW.variante_id, v_stock_actual, NEW.cantidad;
  end if;
  
  update variantes set stock = stock - NEW.cantidad, updated_at = now()
  where id = NEW.variante_id;
  
  insert into movimientos_inv (variante_id, tipo, cantidad, stock_resultante, referencia_tipo, referencia_id)
  values (NEW.variante_id, 'salida', -NEW.cantidad, v_stock_actual - NEW.cantidad, 'venta', NEW.venta_id);
  
  return NEW;
end;
$$ language plpgsql;

create trigger trg_venta_descuenta_stock
after insert on items_venta
for each row execute function fn_venta_descuenta_stock();


-- Auto-cálculo de totales en venta
create or replace function fn_actualizar_total_venta()
returns trigger as $$
begin
  update ventas set
    subtotal = (select coalesce(sum(precio_unitario * cantidad), 0) from items_venta where venta_id = NEW.venta_id),
    total = (select coalesce(sum(precio_unitario * cantidad), 0) from items_venta where venta_id = NEW.venta_id) - ventas.descuento
  where id = NEW.venta_id;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_actualizar_total_venta
after insert or update or delete on items_venta
for each row execute function fn_actualizar_total_venta();


-- Timestamp automático
create or replace function fn_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger trg_productos_updated_at before update on productos for each row execute function fn_updated_at();
create trigger trg_variantes_updated_at before update on variantes for each row execute function fn_updated_at();
create trigger trg_cuentas_updated_at before update on cuentas_por_pagar for each row execute function fn_updated_at();


-- ============================================================
-- VISTAS
-- ============================================================

create or replace view v_kpis_mes as
select
  (select count(*) from ventas where fecha >= date_trunc('month', current_date)) as ventas_count,
  (select coalesce(sum(total), 0) from ventas where fecha >= date_trunc('month', current_date)) as ventas_total,
  (select coalesce(sum(iv.cantidad), 0) from items_venta iv join ventas v on v.id = iv.venta_id where v.fecha >= date_trunc('month', current_date)) as prendas_vendidas,
  (select coalesce(sum(g.monto), 0) from gastos g where g.fecha >= date_trunc('month', current_date)) as gastos_total,
  (select count(*) from variantes where stock > 0 and stock <= stock_minimo and activo) as stock_bajo,
  (select count(*) from variantes where stock = 0 and activo) as sin_stock,
  (select coalesce(sum(stock), 0) from variantes where activo) as total_unidades,
  (select coalesce(sum(stock * costo), 0) from variantes where activo) as inventario_costo,
  (select coalesce(sum(stock * precio_venta), 0) from variantes where activo) as inventario_venta;

create or replace view v_inventario as
select
  v.id, v.sku, v.talla, v.color, v.diseno, v.tipo_estampado,
  v.costo, v.precio_venta, v.stock, v.stock_minimo, v.activo, v.notas,
  v.producto_id,
  p.nombre as producto_nombre, p.tipo as producto_tipo, p.proveedor,
  v.stock <= v.stock_minimo and v.stock > 0 as alerta_stock_bajo,
  v.stock = 0 as sin_stock
from variantes v
join productos p on p.id = v.producto_id
where v.activo
order by p.nombre, v.color, v.talla;

create or replace view v_ventas_detalle as
select
  v.id, v.fecha, v.metodo_pago, v.cliente, v.responsable,
  v.subtotal, v.descuento, v.total, v.notas,
  json_agg(json_build_object(
    'variante_id', iv.variante_id,
    'sku', var.sku,
    'nombre', p.nombre || ' ' || var.talla || ' ' || var.color || coalesce(' — ' || var.diseno, ''),
    'cantidad', iv.cantidad,
    'precio_unitario', iv.precio_unitario
  )) as items
from ventas v
join items_venta iv on iv.venta_id = v.id
join variantes var on var.id = iv.variante_id
join productos p on p.id = var.producto_id
group by v.id
order by v.fecha desc, v.created_at desc;

create or replace view v_gastos_detalle as
select
  g.id, g.fecha, g.monto, g.descripcion, g.metodo_pago,
  g.distribucion, g.monto_jp, g.monto_andres, g.monto_kathe,
  g.notas,
  cg.nombre as categoria,
  cg.es_fijo,
  case when g.distribucion = 'equitativa' then g.monto / 3 when g.distribucion = 'custom' then g.monto_jp else g.monto end as aporte_jp,
  case when g.distribucion = 'equitativa' then g.monto / 3 when g.distribucion = 'custom' then g.monto_andres else g.monto end as aporte_andres,
  case when g.distribucion = 'equitativa' then g.monto / 3 when g.distribucion = 'custom' then g.monto_kathe else g.monto end as aporte_kathe
from gastos g
join categorias_gasto cg on cg.id = g.categoria_id
order by g.fecha desc;
