-- ============================================================
-- ORVANN Schema — PARTE 1: Tablas + Datos semilla
-- Ejecutar PRIMERO en Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- Productos base (tipos de prenda)
create table productos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  tipo text not null,
  proveedor text,
  costo_base int not null default 0,
  costo_estampado_pecho int default 3500,
  costo_estampado_espalda int default 11000,
  costo_etiquetas int default 1700,
  costo_empaque int default 1000,
  precio_venta_basica int default 0,
  precio_venta_estampado int default 0,
  activo boolean default true,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Variantes (cada SKU vendible)
create table variantes (
  id uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references productos(id) on delete cascade,
  sku text not null unique,
  talla text not null,
  color text not null,
  diseno text,
  tipo_estampado text,
  costo int not null,
  precio_venta int not null,
  stock int not null default 0,
  stock_minimo int not null default 3,
  activo boolean default true,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_variantes_producto on variantes(producto_id);
create index idx_variantes_sku on variantes(sku);
create index idx_variantes_stock on variantes(stock);

-- Ventas
create table ventas (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  metodo_pago text not null check (metodo_pago in ('Efectivo', 'Transferencia', 'Datáfono', 'Crédito')),
  cliente text,
  responsable text not null check (responsable in ('JP', 'Andrés', 'Kathe')),
  subtotal int not null default 0,
  descuento int not null default 0,
  total int not null default 0,
  cierre_id uuid,
  notas text,
  created_at timestamptz default now()
);

create index idx_ventas_fecha on ventas(fecha);

-- Items de venta
create table items_venta (
  id uuid primary key default uuid_generate_v4(),
  venta_id uuid not null references ventas(id) on delete cascade,
  variante_id uuid not null references variantes(id),
  cantidad int not null default 1 check (cantidad > 0),
  precio_unitario int not null,
  created_at timestamptz default now()
);

create index idx_items_venta_venta on items_venta(venta_id);
create index idx_items_venta_variante on items_venta(variante_id);

-- Movimientos de inventario
create table movimientos_inv (
  id uuid primary key default uuid_generate_v4(),
  variante_id uuid not null references variantes(id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste', 'transformacion_origen', 'transformacion_destino')),
  cantidad int not null,
  stock_resultante int not null,
  referencia_tipo text,
  referencia_id uuid,
  notas text,
  created_at timestamptz default now()
);

create index idx_movimientos_variante on movimientos_inv(variante_id);

-- Categorías de gasto
create table categorias_gasto (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  es_fijo boolean default false,
  monto_estimado int,
  dia_pago int,
  activo boolean default true
);

-- Gastos
create table gastos (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  categoria_id uuid not null references categorias_gasto(id),
  monto int not null,
  descripcion text,
  metodo_pago text not null default 'Transferencia' check (metodo_pago in ('Efectivo', 'Transferencia', 'Otro')),
  distribucion text not null default 'equitativa' check (distribucion in ('equitativa', 'orvann', 'custom')),
  monto_jp int,
  monto_andres int,
  monto_kathe int,
  notas text,
  created_at timestamptz default now()
);

create index idx_gastos_fecha on gastos(fecha);

-- Cierres de caja
create table cierres_caja (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null unique,
  efectivo_inicio int not null default 0,
  total_efectivo int not null default 0,
  total_transferencias int not null default 0,
  total_datafono int not null default 0,
  total_credito int not null default 0,
  gastos_efectivo int not null default 0,
  consignaciones int not null default 0,
  efectivo_contado int,
  diferencia int,
  cerrado boolean default false,
  notas text,
  created_at timestamptz default now()
);

alter table ventas add constraint fk_ventas_cierre
  foreign key (cierre_id) references cierres_caja(id);

-- Cuentas por pagar
create table cuentas_por_pagar (
  id uuid primary key default uuid_generate_v4(),
  acreedor text not null,
  concepto text not null,
  monto int not null,
  fecha_vencimiento date,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Pagado', 'Parcial')),
  monto_pagado int default 0,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pedidos a proveedores
create table pedidos_proveedor (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  proveedor text not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Recibido', 'Parcial', 'Cancelado')),
  estado_pago text not null default 'Pendiente' check (estado_pago in ('Pendiente', 'Pagado', 'Crédito')),
  total int not null default 0,
  notas text,
  created_at timestamptz default now()
);

create table items_pedido (
  id uuid primary key default uuid_generate_v4(),
  pedido_id uuid not null references pedidos_proveedor(id) on delete cascade,
  variante_id uuid references variantes(id),
  descripcion text,
  cantidad int not null check (cantidad > 0),
  costo_unitario int not null,
  created_at timestamptz default now()
);

-- Transformaciones
create table transformaciones (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  descripcion text,
  costo_estampado_total int default 0,
  notas text,
  created_at timestamptz default now()
);

create table transformacion_detalle (
  id uuid primary key default uuid_generate_v4(),
  transformacion_id uuid not null references transformaciones(id) on delete cascade,
  variante_origen_id uuid not null references variantes(id),
  variante_destino_id uuid not null references variantes(id),
  cantidad int not null check (cantidad > 0),
  created_at timestamptz default now()
);


-- ============================================================
-- RLS (permisivo por ahora, sin auth)
-- ============================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'productos', 'variantes', 'ventas', 'items_venta', 'movimientos_inv',
    'pedidos_proveedor', 'items_pedido', 'gastos', 'categorias_gasto',
    'cierres_caja', 'cuentas_por_pagar', 'transformaciones', 'transformacion_detalle'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "allow_all_%s" on %I for all to authenticated using (true) with check (true)', t, t);
    execute format('create policy "allow_anon_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;


-- ============================================================
-- DATOS SEMILLA
-- ============================================================

-- Categorías de gasto
insert into categorias_gasto (nombre, es_fijo, monto_estimado, dia_pago) values
  ('Arriendo', true, 1210000, 1),
  ('Servicios', true, 220000, 22),
  ('Internet', true, 69000, 14),
  ('Shopify', true, 160000, 30),
  ('Google Workspace', true, 23000, 24),
  ('Capcut', true, 30000, null),
  ('Seguro', true, 96000, 15),
  ('Publicidad/Marketing', false, null, null),
  ('Empaque (Bolsas, Etiquetas)', false, null, null),
  ('Ilustraciones/Diseño', false, null, null),
  ('Mercancía', false, null, null),
  ('Transporte', false, null, null),
  ('Dotación local', false, null, null),
  ('Aseo/Mantenimiento', false, null, null),
  ('Nómina/Vendedor', false, null, null),
  ('Imprevistos', false, null, null),
  ('Otro', false, null, null);

-- Productos base
insert into productos (nombre, tipo, proveedor, costo_base, precio_venta_basica, precio_venta_estampado) values
  ('Camisa Oversize Peruana', 'camisa', 'YOUR BRAND', 37000, 75000, 130000),
  ('Camisa Boxy fit', 'camisa', 'YOUR BRAND', 37000, 75000, 130000),
  ('Camisa Regular', 'camisa', 'YOUR BRAND', 37000, 75000, 130000),
  ('Camisa Oversize', 'camisa', 'AUREN', 35000, 75000, 130000),
  ('Hoodie', 'hoodie', 'YOUR BRAND', 120000, 190000, 250000),
  ('Chompa Capucha', 'chompa', 'YOUR BRAND', 90000, 180000, 230000),
  ('Buzo Cuello Redondo Oversized', 'buzo', 'AUREN', 55000, 120000, 140000),
  ('Buzo Cuello Redondo Regular', 'buzo', 'AUREN', 50000, 120000, 140000),
  ('Jogger Largo', 'jogger', 'AUREN', 55000, 100000, 100000),
  ('Sudadera Bota Recta', 'sudadera', 'AUREN', 55000, 90000, 100000),
  ('Pantaloneta', 'pantaloneta', 'AUREN', 45000, 90000, 90000),
  ('Chaqueta Cortavientos', 'chaqueta', 'AUREN', 40000, 110000, 110000),
  ('Sudadera Cortavientos', 'sudadera', 'AUREN', 32000, 65000, 65000),
  ('Gorra', 'gorra', null, 25000, 50000, 65000),
  ('Camisa Réplica Y/Out', 'camisa', 'BRACOR', 60000, 75000, 75000),
  ('Camisa Réplica 1.1', 'camisa', 'BRACOR', 54000, 75000, 75000);
