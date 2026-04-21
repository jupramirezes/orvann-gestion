# ORVANN Gestión — Modelo de Datos

**Contexto**: Tienda de streetwear en Medellín. 3 socios (Kathe 33.3%, Andrés 33.3%, JP 33.3%). Reemplaza un Google Sheet operativo con 11 hojas inconsistentes. La arquitectura se piensa para replicarla a otros negocios retail similares.

**Proyecto Supabase**: `nldctykjvyqsggwvweeh` (reset completo antes de aplicar).
**Repo**: `orvann-gestion`, branch `v2`.

---

## Principios de diseño

1. **Stock es un ledger, no un campo.** `variantes.stock_cache` se mantiene por trigger sobre `movimientos_inventario`. Cualquier corrección es un movimiento explícito (tipo `ajuste_*` o `baja`).
2. **Costos se fotografían al momento de la venta.** `venta_items.costo_unitario` es snapshot. Cambios posteriores del costo no corrompen históricos.
3. **Venta, consignación y aporte de socio son tres entidades distintas.** El Sheet las mezclaba; aquí se separan (`ventas`, `consignaciones`, `consignaciones.origen='aporte_*'`).
4. **Gastos con distribución ÷3 se guardan UNA vez.** Una fila con `distribucion='equitativa'` y un trigger que llena `monto_kathe/andres/jp`. Adiós a las 3 filas duplicadas del Sheet.
5. **El SKU vendible es la `variante`, no el `producto`.** "Camisa L Blanca" y "Camisa L Blanca estampada Pulp Fiction" son variantes distintas con costo y precio distintos.
6. **Pagos son N por venta.** Tabla `venta_pagos` permite mixto (efectivo + transferencia + datáfono) con foto de comprobante por pago.
7. **Devoluciones y cambios son transacciones nuevas vinculadas.** `ventas.tipo_transaccion` + `ventas.venta_original_id`. Deja rastro histórico y hace trivial reportar devoluciones/mes. El stock se revierte por trigger según `tipo_transaccion`.
8. **Tipos de producto flexibles.** Prendas, fragancias, accesorios y otros conviven en la misma estructura con columnas nullable.

---

## Enums

```sql
-- Productos y catálogo
create type tipo_producto      as enum ('prenda', 'fragancia', 'accesorio', 'otro');
create type categoria_diseno   as enum ('cine', 'musica', 'literatura', 'tv', 'deporte', 'cultura_pop', 'otro');
create type tipo_estampado     as enum (
  'ninguno',
  'punto_corazon_estampado',
  'punto_corazon_bordado',
  'completo_dtg',
  'doble_punto_y_completo'
);

-- Inventario
create type tipo_movimiento    as enum (
  'entrada_pedido', 'venta', 'anulacion_venta',
  'transformacion_out', 'transformacion_in',
  'ajuste_positivo', 'ajuste_negativo', 'baja'
);

-- Pedidos
create type estado_pago_pedido as enum ('pendiente', 'pagado', 'credito');

-- Ventas
create type metodo_pago        as enum ('efectivo', 'transferencia', 'datafono', 'credito', 'plan_separe', 'mixto');
create type canal_venta        as enum ('tienda_fisica', 'whatsapp', 'shopify', 'otro');
create type estado_venta       as enum ('completada', 'anulada', 'plan_separe_abierto');
create type tipo_transaccion   as enum ('venta', 'devolucion', 'cambio');

-- Gastos y finanzas
create type tipo_categoria_gasto  as enum ('fijo', 'variable');
create type distribucion_gasto    as enum ('equitativa', 'asignada', 'orvann', 'custom');
create type pagador_gasto         as enum ('ORVANN', 'KATHE', 'ANDRES', 'JP');
create type cuenta_consignacion   as enum ('ahorros_orvann', 'corriente_orvann', 'nequi_orvann', 'daviplata_orvann', 'otro');
create type origen_consignacion   as enum ('caja_tienda', 'aporte_kathe', 'aporte_andres', 'aporte_jp', 'otro');

-- Plan separe
create type estado_separe      as enum ('abierto', 'completado', 'cancelado');

-- Entregas (Fase 2)
create type estado_entrega     as enum ('pendiente', 'en_ruta', 'entregado', 'devuelto');

-- Usuarios
create type rol_usuario        as enum ('admin', 'vendedor');
```

---

## Tablas

Orden de creación (dependencias primero). `profiles` va temprano porque muchas tablas la referencian.

### `profiles` — usuarios del sistema

Supabase Auth maneja login; `profiles` extiende con datos de negocio.

```sql
create table profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  nombre                  text not null,
  rol                     rol_usuario default 'vendedor',
  es_socio                boolean default false,
  porcentaje_sociedad     numeric(5,2),            -- 33.33 por socio (suma 99.99, informativo)
  telegram_chat_id        text,                    -- F3
  activo                  boolean default true,
  created_at              timestamptz default now()
);
```

### `proveedores`

```sql
create table proveedores (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  contacto_nombre text,
  telefono        text,
  email           text,
  notas           text,
  activo          boolean default true
);
```

### `disenos` — referencias culturales

```sql
create table disenos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  categoria       categoria_diseno,
  descripcion     text,
  referencia_ano  int,
  activo          boolean default true,
  created_at      timestamptz default now()
);
```

### `categorias_gasto`

```sql
create table categorias_gasto (
  id          uuid primary key default gen_random_uuid(),
  nombre      text unique not null,
  tipo        tipo_categoria_gasto not null,
  activa      boolean default true,
  orden       int default 0
);
```

### `parametros_costo` — motor de costos

Costos granulares de estampado, etiquetas, empaque. Referenciados al crear variante para calcular `costo_adicional`.

```sql
create table parametros_costo (
  id                  uuid primary key default gen_random_uuid(),
  concepto            text not null,
  descripcion         text,
  costo_unitario      numeric(12,2) not null,
  aplicable_a         tipo_producto[],
  vigente_desde       date default current_date,
  vigente_hasta       date,
  activo              boolean default true
);
```

### `productos` — catálogo maestro

Familia de SKUs. Un "producto" ("Camisa Oversize Peruana") agrupa N `variantes`.

```sql
create table productos (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_producto not null,
  nombre          text not null,
  marca           text default 'ORVANN',
  proveedor_id    uuid references proveedores(id),
  descripcion     text,
  imagen_url      text,
  activo          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### `variantes` — SKU vendible

```sql
create table variantes (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references productos(id) on delete restrict,
  sku                 text unique not null,                   -- generado por fn_generar_sku
  talla               text,
  color               text,
  diseno_id           uuid references disenos(id),
  estampado           tipo_estampado default 'ninguno',
  costo_base          numeric(12,2) not null,
  costo_adicional     numeric(12,2) default 0,
  costo_total         numeric(12,2) generated always as (costo_base + costo_adicional) stored,
  precio_venta        numeric(12,2) not null,
  margen_porcentaje   numeric(5,4) generated always as (
    case when precio_venta > 0 then (precio_venta - costo_base - costo_adicional) / precio_venta else 0 end
  ) stored,
  imagen_url          text,
  stock_cache         int default 0,                          -- mantenido por trigger
  activo              boolean default true,
  notas               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
```

Generación de SKU: `{PRODUCTO3}-{COLOR3}-{TALLA}[-{DISENO4}]`, sufijo `-2, -3` si colisiona. Ver `fn_generar_sku`.

### `clientes`

```sql
create table clientes (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  telefono                text,
  instagram               text,
  email                   text,
  primera_compra_fecha    date,
  total_comprado_cache    numeric(14,2) default 0,            -- trigger
  num_compras_cache       int default 0,                      -- trigger
  notas                   text,
  created_at              timestamptz default now()
);
```

### `ventas` — transacciones (venta / devolución / cambio)

```sql
create table ventas (
  id                  uuid primary key default gen_random_uuid(),
  fecha               timestamptz default now(),
  cliente_id          uuid references clientes(id),
  tipo_transaccion    tipo_transaccion default 'venta',
  venta_original_id   uuid references ventas(id),             -- null en tipo='venta'; obligatorio en devolucion/cambio
  metodo_pago         metodo_pago not null,                   -- informativo (método dominante); detalle en venta_pagos
  canal               canal_venta default 'tienda_fisica',
  subtotal            numeric(14,2) default 0,                -- trigger
  descuento_monto     numeric(14,2) default 0,
  descuento_motivo    text,                                   -- obligatorio en UI si descuento_monto > 0
  total               numeric(14,2) default 0,                -- trigger: subtotal - descuento_monto
  efectivo_recibido   numeric(14,2),                          -- input del POS si hay pago en efectivo
  vueltas             numeric(14,2),                          -- calculado en el POS y persistido
  estado              estado_venta default 'completada',
  vendedor_id         uuid references profiles(id),
  shopify_order_id    text unique,                            -- F4
  notas               text,
  created_at          timestamptz default now(),
  constraint chk_venta_original check (
    tipo_transaccion = 'venta' or venta_original_id is not null
  ),
  constraint chk_descuento_positivo check (descuento_monto >= 0)
);
```

**Decisión (Alternativa A de devoluciones)**: una devolución = nueva fila con `tipo_transaccion='devolucion'`, `total` negativo, vinculada por `venta_original_id`. Un cambio = **dos filas** vinculadas (una devolución + una venta nueva, ambas apuntando al mismo `venta_original_id`). Esto da trazabilidad histórica completa y hace triviales los reportes "devoluciones del mes". El stock se revierte por trigger leyendo `tipo_transaccion`.

### `venta_items`

```sql
create table venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas(id) on delete cascade,
  variante_id     uuid not null references variantes(id),
  cantidad        int not null default 1,                     -- siempre positivo; signo viene de tipo_transaccion
  precio_unitario numeric(12,2) not null,
  costo_unitario  numeric(12,2) not null,                     -- snapshot de variantes.costo_total al momento
  subtotal        numeric(14,2) generated always as (cantidad * precio_unitario) stored,
  margen_unit     numeric(14,2) generated always as (cantidad * (precio_unitario - costo_unitario)) stored,
  constraint chk_cantidad_positiva check (cantidad > 0),
  constraint chk_precio_positivo   check (precio_unitario >= 0)
);
```

### `venta_pagos` — pagos mixtos (N por venta)

```sql
create table venta_pagos (
  id                  uuid primary key default gen_random_uuid(),
  venta_id            uuid not null references ventas(id) on delete cascade,
  metodo              metodo_pago not null,
  monto               numeric(14,2) not null check (monto > 0),
  referencia          text,                                   -- num comprobante, últimos 4 tarjeta, etc.
  comprobante_url     text,                                   -- bucket Storage 'comprobantes'
  comision_pasarela   numeric(12,2) default 0,                -- F2: 2.5-3% datáfono
  notas               text,
  created_at          timestamptz default now()
);
```

**Invariante (trigger `fn_validar_pagos_venta`)**: `sum(venta_pagos.monto) = ventas.total ± 1 peso` al completar una venta. Para `tipo_transaccion='devolucion'` el monto refleja plata que sale (negativa en términos contables pero positiva en BD; el sentido viene de `tipo_transaccion`).

### `pedidos_proveedor` y `pedidos_proveedor_items`

```sql
create table pedidos_proveedor (
  id                  uuid primary key default gen_random_uuid(),
  proveedor_id        uuid not null references proveedores(id),
  fecha_pedido        date not null,
  fecha_recepcion     date,                                   -- al setearse, trigger emite entrada_pedido
  estado_pago         estado_pago_pedido default 'pendiente',
  fecha_pago          date,
  total               numeric(14,2) default 0,                -- trigger
  notas               text,
  created_at          timestamptz default now()
);

create table pedidos_proveedor_items (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null references pedidos_proveedor(id) on delete cascade,
  variante_id         uuid references variantes(id),          -- null mientras no se mapea
  descripcion_libre   text,                                   -- "10 camisas boxy M negras" cuando aún no hay variante
  unidades            int not null check (unidades > 0),
  costo_unitario      numeric(12,2) not null,
  subtotal            numeric(14,2) generated always as (unidades * costo_unitario) stored
);
```

### `movimientos_inventario` — fuente de verdad del stock

```sql
create table movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  variante_id     uuid not null references variantes(id),
  tipo            tipo_movimiento not null,
  cantidad        int not null,                               -- signo según tipo
  referencia_tipo text,                                       -- 'venta','pedido','transformacion','devolucion'
  referencia_id   uuid,
  fecha           timestamptz default now(),
  usuario_id      uuid references profiles(id),
  notas           text
);
```

### `transformaciones` — básica → estampada

```sql
create table transformaciones (
  id                      uuid primary key default gen_random_uuid(),
  variante_origen_id      uuid not null references variantes(id),
  variante_destino_id     uuid not null references variantes(id),
  cantidad                int not null check (cantidad > 0),
  costo_estampado_unit    numeric(12,2) not null,
  costo_total             numeric(14,2) generated always as (cantidad * costo_estampado_unit) stored,
  fecha                   date default current_date,
  usuario_id              uuid references profiles(id),
  notas                   text,
  created_at              timestamptz default now()
);
```

### `gastos`

```sql
create table gastos (
  id                  uuid primary key default gen_random_uuid(),
  fecha               date not null,
  categoria_id        uuid not null references categorias_gasto(id),
  monto_total         numeric(14,2) not null check (monto_total > 0),
  descripcion         text,
  metodo_pago         metodo_pago not null,
  pagador             pagador_gasto not null,
  distribucion        distribucion_gasto not null default 'equitativa',
  monto_kathe         numeric(14,2) default 0,                -- trigger
  monto_andres        numeric(14,2) default 0,                -- trigger
  monto_jp            numeric(14,2) default 0,                -- trigger
  monto_orvann        numeric(14,2) default 0,                -- trigger
  notas               text,
  created_at          timestamptz default now(),
  constraint chk_suma_gasto check (
    abs((monto_kathe + monto_andres + monto_jp + monto_orvann) - monto_total) <= 1
  )
);
```

### `consignaciones`

```sql
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
```

### `cierres_caja`

```sql
create table cierres_caja (
  id                      uuid primary key default gen_random_uuid(),
  fecha                   date unique not null,
  efectivo_inicio         numeric(14,2) default 0,
  ventas_efectivo         numeric(14,2) default 0,            -- trigger
  ventas_datafono         numeric(14,2) default 0,            -- trigger
  ventas_transferencia    numeric(14,2) default 0,            -- trigger
  ventas_credito          numeric(14,2) default 0,            -- trigger
  ventas_plan_separe      numeric(14,2) default 0,            -- trigger
  gastos_efectivo         numeric(14,2) default 0,            -- trigger
  consignaciones_salida   numeric(14,2) default 0,            -- trigger
  efectivo_esperado       numeric(14,2) generated always as (
    coalesce(efectivo_inicio,0) + coalesce(ventas_efectivo,0)
      - coalesce(gastos_efectivo,0) - coalesce(consignaciones_salida,0)
  ) stored,
  efectivo_contado        numeric(14,2),
  diferencia              numeric(14,2) generated always as (
    coalesce(efectivo_contado,0) - (
      coalesce(efectivo_inicio,0) + coalesce(ventas_efectivo,0)
        - coalesce(gastos_efectivo,0) - coalesce(consignaciones_salida,0)
    )
  ) stored,
  responsable_id          uuid references profiles(id),
  cerrado                 boolean default false,
  notas                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);
```

### `plan_separe`, `plan_separe_items`, `plan_separe_abonos`

Tablas creadas en F1, UI en F2.

```sql
create table plan_separe (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id),
  fecha_inicio    date default current_date,
  fecha_limite    date,
  total           numeric(14,2) not null,
  abonado         numeric(14,2) default 0,
  saldo           numeric(14,2) generated always as (total - abonado) stored,
  estado          estado_separe default 'abierto',
  venta_id        uuid references ventas(id),
  notas           text,
  created_at      timestamptz default now()
);

create table plan_separe_items (
  id              uuid primary key default gen_random_uuid(),
  separe_id       uuid not null references plan_separe(id) on delete cascade,
  variante_id     uuid not null references variantes(id),
  cantidad        int not null check (cantidad > 0),
  precio_unit     numeric(12,2) not null
);

create table plan_separe_abonos (
  id              uuid primary key default gen_random_uuid(),
  separe_id       uuid not null references plan_separe(id),
  fecha           date default current_date,
  monto           numeric(14,2) not null check (monto > 0),
  metodo_pago     metodo_pago not null,
  notas           text
);
```

### `venta_abonos` — venta a crédito (F2, estructura en F1)

```sql
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
```

Columnas auxiliares en `ventas` para crédito (agregar ahora para no migrar después):
```sql
alter table ventas add column es_credito boolean default false;
alter table ventas add column saldo_pendiente numeric(14,2) default 0;
```

### `entregas` — domicilios (F2, estructura en F1)

```sql
create table entregas (
  id                  uuid primary key default gen_random_uuid(),
  venta_id            uuid unique not null references ventas(id),
  direccion           text not null,
  ciudad              text default 'Medellín',
  telefono_contacto   text,
  costo_envio         numeric(12,2) default 0,
  mensajero           text,
  estado              estado_entrega default 'pendiente',
  fecha_programada    date,
  fecha_entrega       timestamptz,
  notas               text
);
```

### `audit_log` — cambios sensibles (F2, estructura en F1)

```sql
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  tabla           text not null,
  registro_id     uuid not null,
  accion          text not null,                              -- INSERT, UPDATE, DELETE
  usuario_id      uuid references profiles(id),
  cambios         jsonb,                                      -- {campo: [valor_viejo, valor_nuevo]}
  created_at      timestamptz default now()
);
```

Trigger genérico en F2 sobre `productos`, `variantes`, `gastos`, `parametros_costo`.

### `bot_logs` — bot Telegram (F3)

```sql
create table bot_logs (
  id                  uuid primary key default gen_random_uuid(),
  chat_id             text not null,
  usuario_id          uuid references profiles(id),
  mensaje_entrante    text,
  intencion           text,
  parametros_json     jsonb,
  respuesta           text,
  exitoso             boolean default true,
  error               text,
  latencia_ms         int,
  created_at          timestamptz default now()
);
```

---

## Funciones y triggers

1. **`fn_actualizar_stock_cache()`** — AFTER INSERT/UPDATE/DELETE en `movimientos_inventario`: `update variantes set stock_cache = (select coalesce(sum(cantidad),0) from movimientos_inventario where variante_id = v.id) where id = v.id`.
2. **`fn_post_venta_item()`** — AFTER INSERT/UPDATE/DELETE en `venta_items`: lee `tipo_transaccion` del parent y emite `movimientos_inventario`. `venta` y `cambio` → `tipo='venta'`, cantidad negativa. `devolucion` → `tipo='anulacion_venta'`, cantidad positiva.
3. **`fn_post_recepcion_pedido()`** — AFTER UPDATE en `pedidos_proveedor` cuando `fecha_recepcion` cambia de null a date: emite `entrada_pedido` por cada item con `variante_id`.
4. **`fn_post_transformacion()`** — AFTER INSERT en `transformaciones`: emite 2 movimientos (`transformacion_out` negativo en origen, `transformacion_in` positivo en destino).
5. **`fn_calcular_distribucion_gasto()`** — BEFORE INSERT/UPDATE en `gastos`:
   - `equitativa` → `monto_kathe = monto_andres = monto_jp = round(monto_total / 3, 2)`; ajuste de ±1 peso al socio con mayor porcentaje para cuadrar.
   - `asignada` → todo al `pagador`.
   - `orvann` → `monto_orvann = monto_total`.
   - `custom` → se respetan los montos enviados; el check constraint valida la suma.
6. **`fn_actualizar_totales_venta()`** — AFTER INSERT/UPDATE/DELETE en `venta_items`, BEFORE UPDATE en `ventas.descuento_monto`: recalcula `subtotal = sum(items.subtotal)` y `total = subtotal - descuento_monto`.
7. **`fn_actualizar_cierre_caja()`** — AFTER INSERT/UPDATE/DELETE en `ventas`, `gastos`, `consignaciones`: upsert en `cierres_caja` del día afectado, agrega o resta según método de pago y origen.
8. **`fn_actualizar_cache_cliente()`** — AFTER INSERT/UPDATE en `ventas` con `estado='completada'` y `cliente_id` no nulo: actualiza `total_comprado_cache` y `num_compras_cache`.
9. **`fn_generar_sku(producto_id, color, talla, diseno_id)`** — retorna text. Toma primeras 3 letras sin acentos del `productos.nombre`, primeras 3 del color, talla tal cual, primeras 4 del `disenos.nombre` si hay. Si el SKU ya existe, agrega sufijo `-2, -3, ...`.
10. **`fn_validar_pagos_venta()`** — AFTER INSERT/UPDATE/DELETE en `venta_pagos`: si la venta está `completada`, verifica `abs(sum(monto) - total) <= 1`; si no cuadra, raise exception.

---

## Constraints de negocio

- `venta_items.precio_unitario >= 0`, `cantidad > 0`.
- `pedidos_proveedor_items.unidades > 0`.
- `transformaciones.cantidad > 0`.
- `gastos.monto_total > 0` + suma de montos por socio ±1 peso.
- `consignaciones.monto > 0`.
- `venta_pagos.monto > 0`; suma ≈ `ventas.total`.
- `ventas`: si `tipo_transaccion ≠ 'venta'`, debe existir `venta_original_id`.
- `cierres_caja`: unique(fecha).
- `ventas.shopify_order_id`: unique.
- **No** se bloquea venta con stock negativo a nivel DB (el admin puede forzar con motivo); la validación es en UI del POS.

---

## Row Level Security

F1: RLS habilitado pero policies abiertas `for all using (true) with check (true)` en todas las tablas, cada una con comentario `TODO: cerrar en F2/F3`. F2/F3 cierra:
- Vendedores (`rol='vendedor'`): SELECT en `productos`/`variantes`/`clientes` activos. INSERT en `ventas`/`venta_items`/`venta_pagos`. NO ven `costo_*`, `gastos`, `parametros_costo`.
- Admins: todo.

Durante F1 la anon key **no se expone** — el POS y el admin van detrás de Supabase Auth.

---

## Storage

Bucket `comprobantes`:
- `public: false`, URL firmada para SELECT.
- INSERT permitido a authenticated.
- Path: `{venta_id}/{timestamp}.{ext}`.
- Max 5MB; compresión en cliente con `browser-image-compression` antes de subir.

---

## Datos de siembra (seed.sql)

1. **proveedores**: AUREN, YOUR BRAND, BRACOR.
2. **categorias_gasto** (17):
   - Fijos (8): Arriendo, Servicios (Agua/Luz/Gas), Internet, Nómina, Contador, Digitales (Shopify/Workspace), Seguros, Imprevistos.
   - Variables (9): Publicidad/Marketing, Empaque, Aseo/Mantenimiento, Transporte, Comisiones datáfono, Ilustraciones/Diseños, Dotación local, Mercancía, Otros.
3. **parametros_costo** (6): estampado_dtg_grande 12.000, punto_corazon_estampado 2.000, punto_corazon_bordado 7.000, etiqueta_espalda 600, marquilla_lavado 600, bolsa 1.000.
4. **disenos** (39): ver `docs/plan/seed-disenos.sql`.
5. **profiles**: se crean tras el primer login de cada socio en Supabase Auth (no se siembran con UUID placeholder).
6. **productos + variantes**: se cargan desde `inventario-fisico.csv` cuando JP lo suba. NO se migra el inventario del Sheet.

Ventas históricas del Sheet (~102 filas): import opcional de una sola vez marcando `notas='import_sheet_abril_2026'`. Se decide en F2.

---

## Fuera de alcance (decisiones explícitas)

- Contabilidad formal (PUC, IVA, retenciones DIAN) — F5 si aplica.
- Multi-tienda / multi-bodega — cuando abran segunda sede.
- Programa de puntos / lealtad.
- Precios por canal (Shopify vs tienda) — F4 si hace falta.
- Zona/ubicación física por variante — descartado: las prendas rotan mucho en la tienda y agregaría ruido.
- Gift cards, propinas, redondeo automático, multi-moneda.
