-- =====================================================================
-- 007_storage — Bucket `comprobantes` para fotos de pago
-- =====================================================================
-- Path: `{venta_id}/{timestamp}.{ext}`. Max 5MB, compresión en cliente
-- con browser-image-compression antes de subir.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Policy: usuarios autenticados pueden subir (INSERT).
create policy "comprobantes_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'comprobantes');

-- Policy: usuarios autenticados pueden leer archivos del bucket.
-- En Fase 2 se restringe por rol si hace falta.
create policy "comprobantes_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'comprobantes');

-- Policy: sólo el dueño puede borrar (admin vía service_role).
-- Se deja cerrado para authenticated en F1.
create policy "comprobantes_delete_service_only"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'comprobantes');
