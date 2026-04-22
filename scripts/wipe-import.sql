-- =====================================================================
-- wipe-import.sql — Borra TODO lo cargado vía import inicial de inventario
-- =====================================================================
-- Usar ANTES de re-correr preparar-import-jp.mjs + generar-sql-import.mjs
-- cuando JP actualice el xlsx y quiera reemplazar el dataset.
--
-- Lo que borra:
--   1. movimientos_inventario con referencia_tipo='import_inicial'
--   2. variantes que solo tienen ese movimiento y 0 ventas asociadas
--   3. productos que queden sin variantes
--
-- Lo que NO borra:
--   - disenos (activo/inactivo conservado)
--   - proveedores, categorias_gasto, parametros_costo
--   - profiles, ventas, gastos, etc.
--
-- ¡ATENCIÓN! Si ya hubo ventas sobre variantes importadas, esas
-- variantes NO se borran para no corromper histórico. El re-import
-- creará duplicados con sufijo -2. En ese caso es mejor ajustar a mano.
-- =====================================================================

-- 1) Variantes que pueden borrarse (solo tienen movimiento inicial)
with variantes_safe as (
  select v.id
  from variantes v
  where exists (
    select 1 from movimientos_inventario m
    where m.variante_id = v.id and m.referencia_tipo = 'import_inicial'
  )
  and not exists (
    select 1 from movimientos_inventario m
    where m.variante_id = v.id and m.referencia_tipo <> 'import_inicial'
  )
  and not exists (
    select 1 from venta_items vi where vi.variante_id = v.id
  )
  and not exists (
    select 1 from plan_separe_items psi where psi.variante_id = v.id
  )
),
-- 2) Borrar movimientos de esas variantes
del_mov as (
  delete from movimientos_inventario
  where variante_id in (select id from variantes_safe)
  returning id
),
-- 3) Borrar las variantes
del_var as (
  delete from variantes
  where id in (select id from variantes_safe)
  returning producto_id
),
-- 4) Borrar productos huérfanos (sin variantes restantes)
del_prod as (
  delete from productos p
  where p.id in (select distinct producto_id from del_var)
  and not exists (select 1 from variantes v where v.producto_id = p.id)
  returning id
)
select
  (select count(*) from variantes_safe) as variantes_borradas,
  (select count(*) from del_mov)        as movimientos_borrados,
  (select count(*) from del_prod)       as productos_borrados;
