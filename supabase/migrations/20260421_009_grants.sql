-- =====================================================================
-- 009_grants — Grants a roles de Supabase sobre schema public
-- =====================================================================
-- Tras el `drop schema public cascade` del 000_reset, Supabase perdió
-- los grants que normalmente crea para los roles `anon`, `authenticated`
-- y `service_role`. Con RLS activa pero sin GRANT base, las queries
-- devuelven "permission denied for table <x>".
--
-- Esta migración restaura los grants a nivel tabla/función/sequence +
-- setea ALTER DEFAULT PRIVILEGES para que tablas futuras los hereden.
--
-- La seguridad real está en las RLS policies; los GRANT solo habilitan
-- la conexión.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Privilegios por defecto para tablas/funciones futuras creadas por postgres
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
