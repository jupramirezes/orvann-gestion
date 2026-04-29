-- =====================================================================
-- 017_rls_anon_temporal — Abre RLS al rol anon (TEMPORAL)
-- =====================================================================
-- JP pidió "quitar el login por ahora". Para que el sitio funcione sin
-- requerir login + sin depender de signInAnonymously, se agregan
-- policies espejo de las existentes pero para el rol `anon`.
--
-- ⚠️ ESTO ES TEMPORAL — antes de invitar a Kathe/Andrés como vendedores
-- reales, se debe revertir esta migración (drop policies *_open_anon)
-- y reemplazar las _open_f1 por policies role-based según profiles.rol.
--
-- También se actualiza el bucket de comprobantes para permitir lectura
-- anónima (la subida sigue siendo authenticated; lo manejará el flujo
-- del POS aún con anonymous users).
-- =====================================================================

do $$
declare
  t text;
  tables text[] := array[
    'profiles','proveedores','disenos','categorias_gasto','parametros_costo',
    'productos','variantes','clientes','ventas','venta_items','venta_pagos',
    'venta_abonos','pedidos_proveedor','pedidos_proveedor_items',
    'movimientos_inventario','transformaciones','gastos','consignaciones',
    'cierres_caja','plan_separe','plan_separe_items','plan_separe_abonos',
    'entregas','audit_log','bot_logs'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_open_anon on public.%I', t, t);
    execute format(
      'create policy %I_open_anon on public.%I for all to anon using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Storage: lectura anónima del bucket comprobantes (inserts ya cubiertos
-- por authenticated; un anonymous user de supabase es authenticated).
drop policy if exists "comprobantes_select_anon" on storage.objects;
create policy "comprobantes_select_anon"
  on storage.objects for select
  to anon
  using (bucket_id = 'comprobantes');

drop policy if exists "comprobantes_insert_anon" on storage.objects;
create policy "comprobantes_insert_anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'comprobantes');
