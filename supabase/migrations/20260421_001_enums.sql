-- =====================================================================
-- 001_enums — Tipos enumerados del dominio
-- =====================================================================

-- Productos y catálogo
create type tipo_producto as enum ('prenda', 'fragancia', 'accesorio', 'otro');

create type categoria_diseno as enum (
  'cine', 'musica', 'literatura', 'tv', 'deporte', 'cultura_pop', 'otro'
);

create type tipo_estampado as enum (
  'ninguno',
  'punto_corazon_estampado',
  'punto_corazon_bordado',
  'completo_dtg',
  'doble_punto_y_completo'
);

-- Inventario
create type tipo_movimiento as enum (
  'entrada_pedido',
  'venta',
  'anulacion_venta',
  'transformacion_out',
  'transformacion_in',
  'ajuste_positivo',
  'ajuste_negativo',
  'baja'
);

-- Pedidos a proveedor
create type estado_pago_pedido as enum ('pendiente', 'pagado', 'credito');

-- Ventas
create type metodo_pago as enum (
  'efectivo', 'transferencia', 'datafono', 'credito', 'plan_separe', 'mixto'
);

create type canal_venta as enum ('tienda_fisica', 'whatsapp', 'shopify', 'otro');

create type estado_venta as enum ('completada', 'anulada', 'plan_separe_abierto');

create type tipo_transaccion as enum ('venta', 'devolucion', 'cambio');

-- Gastos y finanzas
create type tipo_categoria_gasto as enum ('fijo', 'variable');

create type distribucion_gasto as enum ('equitativa', 'asignada', 'orvann', 'custom');

create type pagador_gasto as enum ('ORVANN', 'KATHE', 'ANDRES', 'JP');

create type cuenta_consignacion as enum (
  'ahorros_orvann', 'corriente_orvann', 'nequi_orvann', 'daviplata_orvann', 'otro'
);

create type origen_consignacion as enum (
  'caja_tienda', 'aporte_kathe', 'aporte_andres', 'aporte_jp', 'otro'
);

-- Plan separe
create type estado_separe as enum ('abierto', 'completado', 'cancelado');

-- Entregas (F2, enum creado desde F1)
create type estado_entrega as enum ('pendiente', 'en_ruta', 'entregado', 'devuelto');

-- Usuarios
create type rol_usuario as enum ('admin', 'vendedor');
