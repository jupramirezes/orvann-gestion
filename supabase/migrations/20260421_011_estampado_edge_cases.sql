-- =====================================================================
-- 011_estampado_edge_cases — Completar tipo_estampado con casos mixtos
-- =====================================================================
-- El xlsx real de JP usa 3 columnas SI/NO (punto/bordado/completo) y
-- admite combinaciones que el enum original no cubría:
--   - bordado=SI + completo=SI (sin punto) → necesita valor propio
--   - punto=SI + bordado=SI + completo=SI → triple
-- Agregamos los 2 valores faltantes. Poco probable pero posible.
--
-- Nota: ALTER TYPE ADD VALUE no puede correr dentro de transacción,
-- por eso cada statement va en su propia migración/exec_sql.
-- =====================================================================

alter type tipo_estampado add value if not exists 'doble_bordado_y_completo';
alter type tipo_estampado add value if not exists 'triple_completo';
