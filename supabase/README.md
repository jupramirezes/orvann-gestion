# Supabase — ORVANN Gestión

Proyecto: `nldctykjvyqsggwvweeh`.

## Orden de ejecución de migraciones

Se aplican con `mcp__..._apply_migration` en este orden (los nombres conservan el prefijo de fecha para trazabilidad local, pero Supabase las registra por `version`):

1. `000_reset` — **destructivo**. `drop schema public cascade` + recreate. Sólo en reset inicial, nunca en producción con datos.
2. `001_enums` — todos los enums del dominio.
3. `002_tables` — tablas en orden de dependencias.
4. `003_functions` — 10 funciones de negocio + triggers.
5. `004_triggers` — attach de triggers a las tablas.
6. `005_indexes` — índices de rendimiento.
7. `006_rls` — enable RLS + policies abiertas de Fase 1 (ver warning abajo).
8. `007_storage` — bucket `comprobantes` + policies.

Seed (`seed.sql`) se aplica aparte tras las 8 migraciones.

## ⚠️ RLS abiertas en Fase 1

Todas las tablas tienen RLS habilitado pero con policies `for all using (true) with check (true)`. Esto significa que **cualquiera con la anon key puede leer y escribir todo**.

Mientras estamos en Fase 1:
- La anon key **no se expone** fuera del cliente autenticado.
- El admin y el POS van detrás de Supabase Auth (sólo usuarios loggeados acceden).
- La `service_role` key **nunca se incluye** en código cliente ni se commitea al repo.

En Fase 2 / Fase 3 las policies se cierran según roles (`admin` vs `vendedor`). Cada policy abierta tiene un `comment on policy` con el TODO correspondiente.

## Cómo se aplicaron

Las migraciones se aplican por Claude Code vía MCP Supabase (`apply_migration`). Cada migración queda registrada en `supabase_migrations.schema_migrations` del propio proyecto. Los archivos SQL de este directorio son la fuente de verdad para auditoría y re-deploy.

## Si algo rompe

1. No intentar corregir en caliente con `execute_sql` DDL; rompe el tracking de migraciones.
2. Crear una nueva migración con el fix (ej. `20260421_100_fix_xxx.sql`) y aplicarla.
3. Si hay que empezar de cero: re-correr `000_reset` y todas las siguientes en orden.
