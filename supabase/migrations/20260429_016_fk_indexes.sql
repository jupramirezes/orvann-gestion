-- =====================================================================
-- 016_fk_indexes — Cubre los 22 FKs sin índice del advisor de performance
-- =====================================================================
-- Cada FK sin índice puede generar full-scan en JOINs y al borrar la fila
-- referenciada (cascade). Para volúmenes pequeños no se nota; al crecer
-- la data, sí. Mejor hacerlo ahora antes de cargar data real.
-- =====================================================================

-- venta_items
create index if not exists idx_venta_items_venta on venta_items(venta_id);
create index if not exists idx_venta_items_variante on venta_items(variante_id);

-- venta_pagos: ya hay idx_venta_pagos_venta? Por las dudas, idempotente.
create index if not exists idx_venta_pagos_venta on venta_pagos(venta_id);

-- venta_abonos
create index if not exists idx_venta_abonos_venta on venta_abonos(venta_id);

-- ventas
create index if not exists idx_ventas_vendedor on ventas(vendedor_id);

-- gastos
create index if not exists idx_gastos_categoria on gastos(categoria_id);

-- pedidos_proveedor
create index if not exists idx_pedidos_proveedor on pedidos_proveedor(proveedor_id);

-- pedidos_proveedor_items
create index if not exists idx_pedido_items_pedido on pedidos_proveedor_items(pedido_id);
create index if not exists idx_pedido_items_variante on pedidos_proveedor_items(variante_id);

-- transformaciones
create index if not exists idx_transf_origen on transformaciones(variante_origen_id);
create index if not exists idx_transf_destino on transformaciones(variante_destino_id);
create index if not exists idx_transf_usuario on transformaciones(usuario_id);

-- variantes
create index if not exists idx_variantes_diseno on variantes(diseno_id);

-- productos
create index if not exists idx_productos_proveedor on productos(proveedor_id);

-- plan_separe
create index if not exists idx_separe_cliente on plan_separe(cliente_id);
create index if not exists idx_separe_venta on plan_separe(venta_id);

-- plan_separe_items
create index if not exists idx_separe_items_separe on plan_separe_items(separe_id);
create index if not exists idx_separe_items_variante on plan_separe_items(variante_id);

-- plan_separe_abonos
create index if not exists idx_separe_abonos_separe on plan_separe_abonos(separe_id);

-- consignaciones
create index if not exists idx_consign_responsable on consignaciones(responsable_id);

-- cierres_caja
create index if not exists idx_cierres_responsable on cierres_caja(responsable_id);

-- audit_log
create index if not exists idx_audit_usuario on audit_log(usuario_id);

-- bot_logs
create index if not exists idx_bot_usuario on bot_logs(usuario_id);

-- movimientos_inventario
create index if not exists idx_mov_usuario on movimientos_inventario(usuario_id);
