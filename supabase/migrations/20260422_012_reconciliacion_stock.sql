-- =====================================================================
-- 012_reconciliacion_stock — Herramientas de auditoría de stock_cache
-- =====================================================================
-- variantes.stock_cache es una denormalización mantenida por triggers.
-- Si un trigger falla o un usuario ejecuta SQL directo, el cache puede
-- desalinearse con SUM(movimientos_inventario.cantidad). Estas funciones
-- permiten detectar y corregir drift sin depender de una UI.
--
-- Uso:
--   select * from fn_reconciliar_stock();    -- lista diferencias
--   select fn_corregir_stock_cache();        -- aplica corrección; devuelve filas tocadas
--
-- fn_corregir_stock_cache() es idempotente: correrla dos veces seguidas
-- da 0 en la segunda llamada.
-- =====================================================================

create or replace function fn_reconciliar_stock()
returns table (
  variante_id uuid,
  sku         text,
  stock_cache int,
  stock_real  int,
  diferencia  int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with movs as (
    select variante_id, coalesce(sum(cantidad), 0)::int as stock_real
      from movimientos_inventario
      group by variante_id
  )
  select
    v.id,
    v.sku,
    v.stock_cache,
    coalesce(m.stock_real, 0) as stock_real,
    (v.stock_cache - coalesce(m.stock_real, 0))::int as diferencia
  from variantes v
  left join movs m on m.variante_id = v.id
  where v.stock_cache is distinct from coalesce(m.stock_real, 0)
  order by abs(v.stock_cache - coalesce(m.stock_real, 0)) desc,
           v.sku;
$$;

comment on function fn_reconciliar_stock() is
  'Devuelve variantes cuyo stock_cache difiere de SUM(movimientos). Solo lectura.';

create or replace function fn_corregir_stock_cache()
returns int
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count_con_movs int := 0;
  v_count_sin_movs int := 0;
begin
  with movs as (
    select variante_id, coalesce(sum(cantidad), 0)::int as stock_real
      from movimientos_inventario
      group by variante_id
  )
  update variantes v
     set stock_cache = coalesce(m.stock_real, 0),
         updated_at = now()
    from movs m
   where m.variante_id = v.id
     and v.stock_cache is distinct from coalesce(m.stock_real, 0);
  get diagnostics v_count_con_movs = row_count;

  update variantes
     set stock_cache = 0,
         updated_at = now()
   where stock_cache <> 0
     and not exists (
       select 1 from movimientos_inventario where variante_id = variantes.id
     );
  get diagnostics v_count_sin_movs = row_count;

  return v_count_con_movs + v_count_sin_movs;
end;
$$;

comment on function fn_corregir_stock_cache() is
  'Actualiza stock_cache = SUM(movimientos) para variantes desalineadas. Devuelve filas tocadas. Idempotente.';

grant execute on function fn_reconciliar_stock() to authenticated, service_role;
grant execute on function fn_corregir_stock_cache() to authenticated, service_role;
