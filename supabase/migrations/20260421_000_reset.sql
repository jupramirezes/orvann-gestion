-- =====================================================================
-- 000_reset — Reset destructivo del schema public
-- =====================================================================
--
-- ¡ATENCIÓN! Este archivo borra TODO el schema `public` del proyecto.
-- Se ejecuta UNA sola vez al inicializar ORVANN Gestión (proyecto
-- Supabase `nldctykjvyqsggwvweeh`).
--
-- NO correr en un proyecto con datos de producción.
-- NO correr después de haber cargado inventario físico real.
--
-- =====================================================================

drop schema if exists public cascade;
create schema public;

grant all on schema public to postgres;
grant all on schema public to anon;
grant all on schema public to authenticated;
grant all on schema public to service_role;

comment on schema public is 'ORVANN Gestión — schema principal. Reset inicial 2026-04-21.';
