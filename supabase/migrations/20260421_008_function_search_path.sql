-- =====================================================================
-- 008_function_search_path — Buena práctica de seguridad
-- =====================================================================
-- El linter de Supabase (WARN 0011) recomienda fijar el search_path de
-- cada función plpgsql para prevenir ataques de schema shadowing.
-- Nuestras funciones usan sólo schema public + pg_temp, lo dejamos
-- explícito.
-- =====================================================================

alter function fn_actualizar_stock_cache()        set search_path = public, pg_temp;
alter function fn_post_venta_item()               set search_path = public, pg_temp;
alter function fn_post_recepcion_pedido()         set search_path = public, pg_temp;
alter function fn_post_transformacion()           set search_path = public, pg_temp;
alter function fn_calcular_distribucion_gasto()   set search_path = public, pg_temp;
alter function fn_actualizar_totales_venta()      set search_path = public, pg_temp;
alter function fn_aplicar_descuento_venta()       set search_path = public, pg_temp;
alter function fn_actualizar_cierre_caja()        set search_path = public, pg_temp;
alter function fn_actualizar_cache_cliente()      set search_path = public, pg_temp;
alter function fn_sku_slug(text, int)             set search_path = public, pg_temp;
alter function fn_generar_sku(uuid, text, text, uuid) set search_path = public, pg_temp;
alter function fn_validar_pagos_venta()           set search_path = public, pg_temp;
