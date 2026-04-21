-- =====================================================================
-- 006_rls — Row Level Security
-- =====================================================================
-- Fase 1: todas las policies son abiertas (`using (true) with check (true)`).
-- Esto permite al admin y al POS operar sin restricciones mientras se
-- terminan los flujos. En Fase 2 / Fase 3 se cierran según rol:
--   - rol='vendedor': SELECT en productos/variantes/clientes activos;
--     INSERT en ventas/venta_items/venta_pagos; NO ve costos ni gastos.
--   - rol='admin': acceso completo.
-- Cada policy lleva un comment con el TODO correspondiente.
--
-- Mientras esté abierto: la anon key NO se expone; POS y admin van
-- detrás de Supabase Auth.
-- =====================================================================

-- Macro helper: activar RLS + policy abierta en una tabla
do $$
declare
  t text;
  tablas text[] := array[
    'profiles',
    'proveedores',
    'disenos',
    'categorias_gasto',
    'parametros_costo',
    'productos',
    'variantes',
    'clientes',
    'ventas',
    'venta_items',
    'venta_pagos',
    'venta_abonos',
    'pedidos_proveedor',
    'pedidos_proveedor_items',
    'movimientos_inventario',
    'transformaciones',
    'gastos',
    'consignaciones',
    'cierres_caja',
    'plan_separe',
    'plan_separe_items',
    'plan_separe_abonos',
    'entregas',
    'audit_log',
    'bot_logs'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "%s_open_f1" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
    execute format(
      'comment on policy "%s_open_f1" on %I is ''TODO F2/F3: cerrar policy según rol (admin vs vendedor). Ver 01-modelo-datos.md §RLS.''',
      t, t
    );
  end loop;
end;
$$;
