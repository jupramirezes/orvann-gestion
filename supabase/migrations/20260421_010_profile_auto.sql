-- =====================================================================
-- 010_profile_auto — Auto-crear profile al registrar usuario en Auth
-- =====================================================================
-- Cada fila en `auth.users` debe tener su par en `public.profiles`.
-- Este trigger lo hace automáticamente al insertar un auth user.
--
-- Default: `rol='admin'` — durante F1 sólo hay 3 socios, todos admin.
-- Cuando se creen vendedores en F2 se cambia a 'vendedor' por default
-- y se promueve manualmente a admin.
-- =====================================================================

create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nombre, rol, es_socio)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre', ''),
      initcap(split_part(new.email, '@', 1))
    ),
    'admin',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- Backfill: crear profile para usuarios ya existentes que no lo tengan.
insert into public.profiles (id, nombre, rol, es_socio)
select
  u.id,
  initcap(split_part(u.email, '@', 1)),
  'admin',
  true
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
