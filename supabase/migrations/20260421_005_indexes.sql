-- =====================================================================
-- 005_indexes — Índices de rendimiento
-- =====================================================================

-- Productos / variantes
create index idx_productos_tipo         on productos(tipo) where activo = true;
create index idx_variantes_producto     on variantes(producto_id);
create index idx_variantes_stock_bajo   on variantes(stock_cache)
  where activo = true and stock_cache < 3;

-- Inventario
create index idx_mov_variante on movimientos_inventario(variante_id, fecha desc);

-- Clientes
create index idx_clientes_telefono on clientes(telefono);

-- Ventas
create index idx_ventas_fecha    on ventas(fecha desc);
create index idx_ventas_cliente  on ventas(cliente_id) where cliente_id is not null;
create index idx_ventas_original on ventas(venta_original_id) where venta_original_id is not null;
create index idx_ventas_estado   on ventas(estado, fecha desc);

-- Venta_pagos (FK lookup)
create index idx_venta_pagos_venta on venta_pagos(venta_id);

-- Pedidos
create index idx_pedidos_estado on pedidos_proveedor(estado_pago, fecha_pedido desc);

-- Gastos
create index idx_gastos_fecha_categoria on gastos(fecha desc, categoria_id);
create index idx_gastos_pagador         on gastos(pagador, fecha desc);

-- Cierres
create index idx_cierres_mes on cierres_caja(fecha desc);

-- Plan separe
create index idx_separe_estado on plan_separe(estado, fecha_limite);

-- Audit log
create index idx_audit_tabla_registro on audit_log(tabla, registro_id, created_at desc);
