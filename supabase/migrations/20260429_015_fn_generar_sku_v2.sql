-- =====================================================================
-- 015_fn_generar_sku_v2 — SKU sin sufijos -2/-3 (resuelve C-29)
-- =====================================================================
-- La versión anterior usaba 4 letras del nombre del diseño y al chocar
-- caía a sufijos numéricos -2/-3 (~17 de 87 SKUs en el último import).
--
-- La versión nueva expande progresivamente las letras del diseño hasta
-- 8 caracteres antes de caer a sufijos. Solo si después de 8 letras
-- todavía colisiona se agrega -2, -3, etc.
--
-- Casos:
--   "Gris Claro" + "Gris Oscuro" → 4 letras coinciden ("GRIS"), 5 letras
--   no ("GRISC" vs "GRISO") → ambos SKUs limpios.
-- =====================================================================

create or replace function fn_generar_sku(
  p_producto_id uuid,
  p_color       text,
  p_talla       text,
  p_diseno_id   uuid
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_prod   text;
  v_col    text;
  v_tal    text;
  v_dis    text;
  v_base   text;
  v_try    text;
  v_dis_n  int;
  v_i      int := 1;
begin
  select fn_sku_slug(nombre, 3) into v_prod from productos where id = p_producto_id;
  v_col := coalesce(fn_sku_slug(p_color, 3), '');
  v_tal := coalesce(fn_sku_slug(p_talla, 4), '');

  if p_diseno_id is not null then
    -- Probar con 4..8 letras del diseño hasta encontrar SKU libre
    for v_dis_n in 4..8 loop
      select fn_sku_slug(nombre, v_dis_n) into v_dis from disenos where id = p_diseno_id;
      v_try := concat_ws('-',
        nullif(v_prod, ''),
        nullif(v_col,  ''),
        nullif(v_tal,  ''),
        nullif(v_dis,  '')
      );
      if v_try is null or length(v_try) = 0 then
        v_try := 'SKU';
      end if;
      if not exists (select 1 from variantes where sku = v_try) then
        return v_try;
      end if;
    end loop;
    -- 8 letras del diseño no alcanzaron — base para sufijo numérico
    v_base := v_try;
  else
    v_base := concat_ws('-',
      nullif(v_prod, ''),
      nullif(v_col,  ''),
      nullif(v_tal,  '')
    );
  end if;

  if v_base is null or length(v_base) = 0 then
    v_base := 'SKU';
  end if;

  v_try := v_base;
  while exists (select 1 from variantes where sku = v_try) loop
    v_i := v_i + 1;
    v_try := v_base || '-' || v_i::text;
  end loop;

  return v_try;
end;
$$;

comment on function fn_generar_sku(uuid, text, text, uuid) is
  'Genera SKU expandiendo letras del diseño antes de caer a sufijos numéricos. C-29 resuelto.';
