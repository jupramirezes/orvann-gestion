-- =====================================================================
-- wipe-import.sql — Borra lo cargado vía import_inicial (idempotente)
-- =====================================================================
-- Usar ANTES de re-correr preparar-import-jp.mjs + generar-sql-import.mjs
-- cuando se actualice el xlsx y se quiera reemplazar el dataset.
--
-- Cada statement debe aplicarse por separado (no en un solo CTE) porque
-- PostgreSQL evalúa los CTEs modificantes sobre el snapshot original, no
-- sobre el estado tras los DELETEs previos. Aplicar en orden:
--
--   1. movimientos_inventario con referencia_tipo='import_inicial'
--   2. variantes cuyo SOLO movimiento era el inicial y sin ventas
--   3. productos que queden sin variantes
--
-- Lo que NO se borra:
--   - variantes que ya tienen ventas o están en planes de separe
--   - productos que aún tienen variantes vivas
--   - disenos, proveedores, categorias_gasto, parametros_costo, profiles
--
-- Si hubo ventas sobre variantes importadas, esas variantes se
-- conservan. El re-import creará nuevas con sufijo -2 (ajustar a mano
-- si hace falta consolidar).
-- =====================================================================

-- Statement 1: borrar movimientos_inventario tipo import_inicial de
-- variantes que no tienen venta ni plan_separe.
delete from movimientos_inventario m
where m.referencia_tipo = 'import_inicial'
  and not exists (select 1 from venta_items vi       where vi.variante_id  = m.variante_id)
  and not exists (select 1 from plan_separe_items ps where ps.variante_id  = m.variante_id);

-- Statement 2: borrar variantes huérfanas (sin movimientos, sin ventas,
-- sin separes). Tras el statement 1, quedan variantes del import sin
-- movimientos asociados — esas salen aquí.
delete from variantes v
where not exists (select 1 from movimientos_inventario m where m.variante_id = v.id)
  and not exists (select 1 from venta_items vi            where vi.variante_id = v.id)
  and not exists (select 1 from plan_separe_items ps      where ps.variante_id = v.id);

-- Statement 3: borrar productos huérfanos (sin variantes).
delete from productos p
where not exists (select 1 from variantes v where v.producto_id = p.id);

-- Verificación final
select
  (select count(*) from productos)              as productos_restantes,
  (select count(*) from variantes)              as variantes_restantes,
  (select count(*) from movimientos_inventario) as movimientos_restantes;
