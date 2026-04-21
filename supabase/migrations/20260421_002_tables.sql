-- =====================================================================
-- 002_tables — Tablas del modelo
-- =====================================================================
-- Orden: dependencias primero. Tablas auxiliares (F2/F3) se crean aquí
-- para que el schema nazca completo y no haya migraciones extra luego.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: extensión de auth.users con datos de negocio
-- ---------------------------------------------------------------------
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  nombre               text not null,
  rol                  rol_usuario default 'vendedor',
  es_socio             boolean default false,
  porcentaje_sociedad  numeric(5,2),
  telegram_chat_id     text,
  activo               boolean default true,
  created_at           timestamptz default now()
);
comment on table profiles is
  'Usuarios del sistema. Extiende auth.users con rol y datos de socio.';

-- ---------------------------------------------------------------------
-- proveedores
-- ---------------------------------------------------------------------
create table proveedores (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  contacto_nombre text,
  telefono        text,
  email           text,
  notas           text,
  activo          boolean default true
);

-- ---------------------------------------------------------------------
-- disenos: catálogo cultural (Pulp Fiction, Pedro Navaja, etc.)
-- ---------------------------------------------------------------------
create table disenos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  categoria      categoria_diseno,
  descripcion    text,
  referencia_ano int,
  activo         boolean default true,
  created_at     timestamptz default now()
);

-- ---------------------------------------------------------------------
-- categorias_gasto
-- ---------------------------------------------------------------------
create table categorias_gasto (
  id     uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  tipo   tipo_categoria_gasto not null,
  activa boolean default true,
  orden  int default 0
);

-- ---------------------------------------------------------------------
-- parametros_costo: motor de costos granular
-- ---------------------------------------------------------------------
create table parametros_costo (
  id             uuid primary key default gen_random_uuid(),
  concepto       text not null,
  descripcion    text,
  costo_unitario numeric(12,2) not null,
  aplicable_a    tipo_producto[],
  vigente_desde  date default current_date,
  vigente_hasta  date,
  activo         boolean default true
);

-- ---------------------------------------------------------------------
-- productos: catálogo maestro (familia de SKUs)
-- ---------------------------------------------------------------------
create table productos (
  id           uuid primary key default gen_random_uuid(),
  tipo         tipo_producto not null,
  nombre       text not null,
  marca        text default 'ORVANN',
  proveedor_id uuid references proveedores(id),
  descripcion  text,
  imagen_url   text,
  activo       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ---------------------------------------------------------------------
-- variantes: SKU vendible. stock_cache lo mantiene trigger.
-- ---------------------------------------------------------------------
create table variantes (
  id                uuid primary key default gen_random_uuid(),
  producto_id       uuid not null references productos(id) on delete restrict,
  sku               text unique not null,
  talla             text,
  color             text,
  diseno_id         uuid references disenos(id),
  estampado         tipo_estampado default 'ninguno',
  costo_base        numeric(12,2) not null,
  costo_adicional   numeric(12,2) default 0,
  costo_total       numeric(12,2) generated always as (costo_base + costo_adicional) stored,
  precio_venta      numeric(12,2) not null,
  margen_porcentaje numeric(5,4) generated always as (
    case when precio_venta > 0
      then (precio_venta - costo_base - costo_adicional) / precio_venta
      else 0
    end
  ) stored,
  imagen_url        text,
  stock_cache       int default 0,
  activo            boolean default true,
  notas             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ---------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------
create table clientes (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  telefono             text,
  instagram            text,
  email                text,
  primera_compra_fecha date,
  total_comprado_cache numeric(14,2) default 0,
  num_compras_cache    int default 0,
  notas                text,
  created_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- ventas: transacciones (venta / devolucion / cambio)
-- ---------------------------------------------------------------------
create table ventas (
  id                uuid primary key default gen_random_uuid(),
  fecha             timestamptz default now(),
  cliente_id        uuid references clientes(id),
  tipo_transaccion  tipo_transaccion default 'venta',
  venta_original_id uuid references ventas(id),
  metodo_pago       metodo_pago not null,
  canal             canal_venta default 'tienda_fisica',
  subtotal          numeric(14,2) default 0,
  descuento_monto   numeric(14,2) default 0,
  descuento_motivo  text,
  total             numeric(14,2) default 0,
  efectivo_recibido numeric(14,2),
  vueltas           numeric(14,2),
  estado            estado_venta default 'completada',
  vendedor_id       uuid references profiles(id),
  shopify_order_id  text unique,
  es_credito        boolean default false,
  saldo_pendiente   numeric(14,2) default 0,
  notas             text,
  created_at        timestamptz default now(),
  constraint chk_venta_original
    check (tipo_transaccion = 'venta' or venta_original_id is not null),
  constraint chk_descuento_positivo
    check (descuento_monto >= 0)
);
comment on column ventas.metodo_pago is
  'Método dominante (informativo). La verdad está en venta_pagos.';
comment on column ventas.venta_original_id is
  'Obligatorio si tipo_transaccion es devolucion o cambio.';

-- ---------------------------------------------------------------------
-- venta_items
-- ---------------------------------------------------------------------
create table venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas(id) on delete cascade,
  variante_id     uuid not null references variantes(id),
  cantidad        int not null default 1,
  precio_unitario numeric(12,2) not null,
  costo_unitario  numeric(12,2) not null,
  subtotal        numeric(14,2) generated always as (cantidad * precio_unitario) stored,
  margen_unit     numeric(14,2) generated always as (cantidad * (precio_unitario - costo_unitario)) stored,
  constraint chk_cantidad_positiva check (cantidad > 0),
  constraint chk_precio_positivo   check (precio_unitario >= 0)
);
comment on column venta_items.cantidad is
  'Siempre positiva. El signo del movimiento de inventario se deriva de ventas.tipo_transaccion.';
comment on column venta_items.costo_unitario is
  'Snapshot del costo_total de la variante al momento de la venta.';

-- ---------------------------------------------------------------------
-- venta_pagos: N pagos por venta (mixto)
-- ---------------------------------------------------------------------
create table venta_pagos (
  id                uuid primary key default gen_random_uuid(),
  venta_id          uuid not null references ventas(id) on delete cascade,
  metodo            metodo_pago not null,
  monto             numeric(14,2) not null check (monto > 0),
  referencia        text,
  comprobante_url   text,
  comision_pasarela numeric(12,2) default 0,
  notas             text,
  created_at        timestamptz default now()
);
comment on table venta_pagos is
  'Pagos mixtos. Suma debe igualar ventas.total en ventas completadas (validado por trigger).';

-- ---------------------------------------------------------------------
-- venta_abonos: venta a crédito (UI en F2, tabla ya en F1)
-- ---------------------------------------------------------------------
create table venta_abonos (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas(id),
  fecha           date default current_date,
  monto           numeric(14,2) not null check (monto > 0),
  metodo          metodo_pago not null,
  referencia      text,
  comprobante_url text,
  notas           text
);

-- ---------------------------------------------------------------------
-- pedidos_proveedor
-- ---------------------------------------------------------------------
create table pedidos_proveedor (
  id              uuid primary key default gen_random_uuid(),
  proveedor_id    uuid not null references proveedores(id),
  fecha_pedido    date not null,
  fecha_recepcion date,
  estado_pago     estado_pago_pedido default 'pendiente',
  fecha_pago      date,
  total           numeric(14,2) default 0,
  notas           text,
  created_at      timestamptz default now()
);

create table pedidos_proveedor_items (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references pedidos_proveedor(id) on delete cascade,
  variante_id       uuid references variantes(id),
  descripcion_libre text,
  unidades          int not null check (unidades > 0),
  costo_unitario    numeric(12,2) not null,
  subtotal          numeric(14,2) generated always as (unidades * costo_unitario) stored
);

-- ---------------------------------------------------------------------
-- movimientos_inventario: fuente de verdad del stock
-- ---------------------------------------------------------------------
create table movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  variante_id     uuid not null references variantes(id),
  tipo            tipo_movimiento not null,
  cantidad        int not null,
  referencia_tipo text,
  referencia_id   uuid,
  fecha           timestamptz default now(),
  usuario_id      uuid references profiles(id),
  notas           text
);
comment on column movimientos_inventario.cantidad is
  'Positivo o negativo según tipo. variantes.stock_cache = SUM(cantidad).';

-- ---------------------------------------------------------------------
-- transformaciones: básica → estampada
-- ---------------------------------------------------------------------
create table transformaciones (
  id                   uuid primary key default gen_random_uuid(),
  variante_origen_id   uuid not null references variantes(id),
  variante_destino_id  uuid not null references variantes(id),
  cantidad             int not null check (cantidad > 0),
  costo_estampado_unit numeric(12,2) not null,
  costo_total          numeric(14,2) generated always as (cantidad * costo_estampado_unit) stored,
  fecha                date default current_date,
  usuario_id           uuid references profiles(id),
  notas                text,
  created_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- gastos: con distribución automática entre socios
-- ---------------------------------------------------------------------
create table gastos (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,
  categoria_id uuid not null references categorias_gasto(id),
  monto_total  numeric(14,2) not null check (monto_total > 0),
  descripcion  text,
  metodo_pago  metodo_pago not null,
  pagador      pagador_gasto not null,
  distribucion distribucion_gasto not null default 'equitativa',
  monto_kathe  numeric(14,2) default 0,
  monto_andres numeric(14,2) default 0,
  monto_jp     numeric(14,2) default 0,
  monto_orvann numeric(14,2) default 0,
  notas        text,
  created_at   timestamptz default now(),
  constraint chk_suma_gasto check (
    abs((monto_kathe + monto_andres + monto_jp + monto_orvann) - monto_total) <= 1
  )
);

-- ---------------------------------------------------------------------
-- consignaciones: efectivo caja→cuenta + aportes de socios
-- ---------------------------------------------------------------------
create table consignaciones (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default current_date,
  monto           numeric(14,2) not null check (monto > 0),
  origen          origen_consignacion not null,
  cuenta_destino  cuenta_consignacion default 'ahorros_orvann',
  responsable_id  uuid references profiles(id),
  comprobante_url text,
  notas           text,
  created_at      timestamptz default now()
);

-- ---------------------------------------------------------------------
-- cierres_caja: consolida caja diaria + cierre de caja
-- ---------------------------------------------------------------------
create table cierres_caja (
  id                    uuid primary key default gen_random_uuid(),
  fecha                 date unique not null,
  efectivo_inicio       numeric(14,2) default 0,
  ventas_efectivo       numeric(14,2) default 0,
  ventas_datafono       numeric(14,2) default 0,
  ventas_transferencia  numeric(14,2) default 0,
  ventas_credito        numeric(14,2) default 0,
  ventas_plan_separe    numeric(14,2) default 0,
  gastos_efectivo       numeric(14,2) default 0,
  consignaciones_salida numeric(14,2) default 0,
  efectivo_esperado     numeric(14,2) generated always as (
    coalesce(efectivo_inicio, 0)
      + coalesce(ventas_efectivo, 0)
      - coalesce(gastos_efectivo, 0)
      - coalesce(consignaciones_salida, 0)
  ) stored,
  efectivo_contado      numeric(14,2),
  diferencia            numeric(14,2) generated always as (
    coalesce(efectivo_contado, 0) - (
      coalesce(efectivo_inicio, 0)
        + coalesce(ventas_efectivo, 0)
        - coalesce(gastos_efectivo, 0)
        - coalesce(consignaciones_salida, 0)
    )
  ) stored,
  responsable_id        uuid references profiles(id),
  cerrado               boolean default false,
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ---------------------------------------------------------------------
-- plan_separe + items + abonos (UI en F2, tablas en F1)
-- ---------------------------------------------------------------------
create table plan_separe (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references clientes(id),
  fecha_inicio date default current_date,
  fecha_limite date,
  total        numeric(14,2) not null,
  abonado      numeric(14,2) default 0,
  saldo        numeric(14,2) generated always as (total - abonado) stored,
  estado       estado_separe default 'abierto',
  venta_id     uuid references ventas(id),
  notas        text,
  created_at   timestamptz default now()
);

create table plan_separe_items (
  id          uuid primary key default gen_random_uuid(),
  separe_id   uuid not null references plan_separe(id) on delete cascade,
  variante_id uuid not null references variantes(id),
  cantidad    int not null check (cantidad > 0),
  precio_unit numeric(12,2) not null
);

create table plan_separe_abonos (
  id          uuid primary key default gen_random_uuid(),
  separe_id   uuid not null references plan_separe(id),
  fecha       date default current_date,
  monto       numeric(14,2) not null check (monto > 0),
  metodo_pago metodo_pago not null,
  notas       text
);

-- ---------------------------------------------------------------------
-- entregas: domicilios (UI en F2, tabla en F1)
-- ---------------------------------------------------------------------
create table entregas (
  id                uuid primary key default gen_random_uuid(),
  venta_id          uuid unique not null references ventas(id),
  direccion         text not null,
  ciudad            text default 'Medellín',
  telefono_contacto text,
  costo_envio       numeric(12,2) default 0,
  mensajero         text,
  estado            estado_entrega default 'pendiente',
  fecha_programada  date,
  fecha_entrega     timestamptz,
  notas             text
);

-- ---------------------------------------------------------------------
-- audit_log (F2, trigger genérico en F2; tabla en F1)
-- ---------------------------------------------------------------------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null,
  usuario_id  uuid references profiles(id),
  cambios     jsonb,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- bot_logs (F3)
-- ---------------------------------------------------------------------
create table bot_logs (
  id               uuid primary key default gen_random_uuid(),
  chat_id          text not null,
  usuario_id       uuid references profiles(id),
  mensaje_entrante text,
  intencion        text,
  parametros_json  jsonb,
  respuesta        text,
  exitoso          boolean default true,
  error            text,
  latencia_ms      int,
  created_at       timestamptz default now()
);
