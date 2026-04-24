-- =====================================================================
-- 014_realtime_ventas — Habilitar Realtime en ventas
-- =====================================================================
-- Suscribe la tabla `ventas` a la publication `supabase_realtime` para
-- que el admin pueda recibir eventos en vivo cuando se registra una
-- venta desde el POS (estado pasa a 'completada').
--
-- Se suscriben solo las tablas estrictamente necesarias; para detalle
-- de venta con items y pagos el admin puede hacer un fetch adicional
-- al recibir el evento inicial.
-- =====================================================================

-- Agregar ventas a la publication (idempotente con IF EXISTS/DROP)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ventas'
  ) then
    alter publication supabase_realtime add table ventas;
  end if;
end $$;
