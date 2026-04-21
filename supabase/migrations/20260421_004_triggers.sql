-- =====================================================================
-- 004_triggers — Attach de triggers
-- =====================================================================

-- Stock cache: se actualiza con cada cambio en movimientos_inventario
create trigger trg_stock_cache_mov
  after insert or update or delete on movimientos_inventario
  for each row execute function fn_actualizar_stock_cache();

-- Venta items → movimiento de inventario (signo según tipo_transaccion)
create trigger trg_post_venta_item
  after insert or update or delete on venta_items
  for each row execute function fn_post_venta_item();

-- Recepción de pedido: emite entrada_pedido al setear fecha_recepcion
create trigger trg_post_recepcion
  after update on pedidos_proveedor
  for each row execute function fn_post_recepcion_pedido();

-- Transformación: emite 2 movimientos (out + in)
create trigger trg_post_transformacion
  after insert on transformaciones
  for each row execute function fn_post_transformacion();

-- Gastos: distribución automática entre socios
create trigger trg_distribucion_gasto
  before insert or update on gastos
  for each row execute function fn_calcular_distribucion_gasto();

-- Totales de venta: recalcula subtotal/total tras cambios en items
create trigger trg_totales_venta
  after insert or update or delete on venta_items
  for each row execute function fn_actualizar_totales_venta();

-- Descuento de venta: recalcula total cuando cambia descuento_monto
create trigger trg_aplicar_descuento
  before update of descuento_monto on ventas
  for each row execute function fn_aplicar_descuento_venta();

-- Cierre de caja: upsert agregados del día
create trigger trg_cierre_caja_ventas
  after insert or update or delete on ventas
  for each row execute function fn_actualizar_cierre_caja();

create trigger trg_cierre_caja_gastos
  after insert or update or delete on gastos
  for each row execute function fn_actualizar_cierre_caja();

create trigger trg_cierre_caja_consign
  after insert or update or delete on consignaciones
  for each row execute function fn_actualizar_cierre_caja();

-- Cache cliente: total comprado + num_compras
create trigger trg_cache_cliente
  after insert or update of estado, total, tipo_transaccion, cliente_id on ventas
  for each row execute function fn_actualizar_cache_cliente();

-- Validación de suma de pagos al completar venta
create trigger trg_validar_pagos_venta
  after insert or update or delete on venta_pagos
  for each row execute function fn_validar_pagos_venta();
