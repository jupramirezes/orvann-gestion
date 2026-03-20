# ORVANN — Sistema de Gestión para Tienda de Ropa

## Contexto para Claude Code

\---

## QUÉ ES ORVANN

Tienda de streetwear en Medellín, Colombia. Temática de nostalgia cinematográfica (Pulp Fiction, Willie Colón, Lavoe, etc.). 3 socios: JP, Andrés, Kathe. Abrió en enero 2026.

Actualmente todo se gestiona en un Google Sheets (inventario, ventas, gastos, cierres de caja). Es manual, propenso a errores, y no escala. Este sistema lo reemplaza. (link: https://docs.google.com/spreadsheets/d/1kZbtX9KALAfeSco\_OLJbiOvxSmECIvMK7x1dGPxdMhA/edit?pli=1\&gid=2143637721#gid=2143637721)

## PROBLEMA PRINCIPAL

Cuando se vende una prenda, hay que ir manualmente al Sheets a descontar del inventario, registrar la venta, actualizar totales. Eso no pasa en tiempo real, se olvida, y el inventario se descuadra. Además, las prendas básicas (ej: camiseta blanca L) se llevan a estampar con diferentes diseños (Pulp Fiction, Willie Colón, etc.) y rastrear eso en Excel es un caos.

## STACK

* React 19 + TypeScript + Tailwind CSS v4 + Vite
* Supabase (PostgreSQL + Realtime) — Proyecto: nldctykjvyqsggwvweeh
* Vercel para deploy (PWA installable en celular)
* Mismo stack que otro proyecto mío: durata\_crm (React 19, TS, Tailwind v4 con @theme en CSS, Vite, Supabase, Vercel)

## REPO Y ENTORNO

* Repo: https://github.com/jupramirezes/orvann-gestion
* Branch de trabajo: `dev` (nunca push directo a main, merge solo para deploy)
* Supabase URL: https://nldctykjvyqsggwvweeh.supabase.co
* La anon key la tengo en .env.local

\---

## MODELO DE DATOS

Ya tengo un archivo `schema.sql` en la raíz del proyecto con el schema completo de Supabase. Consultalo para ver las tablas, relaciones, triggers y vistas.

Las tablas principales son:

**productos** → Tipos de prenda (Camisa Oversize Peruana, Hoodie, Chompa, etc.) con costos desglosados (base, estampado pecho, estampado espalda, etiquetas, empaque).

**variantes** → Cada SKU vendible. Un producto tiene múltiples variantes por combinación de talla + color + diseño. Ejemplo: "Camisa Oversize Peruana" tiene variantes como CAM-OVS-NEG-M (Negro M básica), CAM-OVS-NEG-M-PULP (Negro M con estampado Pulp Fiction). Cada variante tiene su propio stock, costo y precio de venta.

**ventas** + **items\_venta** → Una venta tiene múltiples ítems. Cada ítem referencia una variante con cantidad y precio\_unitario (el precio puede variar de una venta a otra, porque se negocia con el cliente). Hay un trigger que automáticamente descuenta el stock de la variante al insertar un item\_venta.

**movimientos\_inv** → Log inmutable de todo cambio de stock (entrada, salida por venta, ajuste manual, transformación por estampado). Permite auditar por qué el stock está en X número.

**gastos** + **categorias\_gasto** → Los gastos se registran una vez con el monto total. La distribución entre socios es por default equitativa (÷3), pero puede ser custom.

**cierres\_caja** → Cierre diario que agrupa ventas por método de pago y cuadra efectivo.

**cuentas\_por\_pagar** → Deudas pendientes con proveedores y otros.

**transformaciones** + **transformacion\_detalle** → Cuando se llevan prendas básicas a estampar, se descuenta stock del SKU base y se crea/incrementa stock en los SKUs estampados.

\---

## LO QUE QUIERO CONSTRUIR — SESIÓN 1

### Objetivo: Setup del proyecto + Módulo de Inventario + Venta Rápida

### 1\. Inicialización

* Proyecto Vite con React 19 + TS + Tailwind v4 (usar @theme en CSS, no tailwind.config.js)
* Supabase client configurado
* Tipografía: DM Sans (Google Fonts)
* PWA básica (manifest.json para instalar en celular)
* vercel.json con rewrite SPA
* Tema oscuro: fondo #0a0a0a, superficies #141414, bordes #222, acento verde #1D9E75

### 2\. Layout y navegación

* Mobile-first. El uso principal es desde el celular en la tienda.
* Navegación inferior con 5 tabs: Inicio, Inventario, + (Venta rápida — botón destacado), Gastos, Caja
* Header simple con "ORVANN" y subtítulo "Sistema de gestión"

### 3\. Dashboard (Inicio)

* KPIs del mes: ventas totales, gastos totales, inventario (unidades + valor a costo), alertas de stock
* Barra de progreso de punto de equilibrio (prendas vendidas vs 42 necesarias para cubrir costos fijos de $1.957.900/mes)
* Últimas 5 ventas

### 4\. Módulo de Inventario

* Tabla/lista de variantes con: nombre, SKU, talla, color, diseño (si tiene), stock, precio
* **Edición inline** — quiero poder hacer click en el stock, precio o cualquier campo y editarlo directamente en la fila, como en Excel. NO quiero modales para editar. La versatilidad de poder cambiar datos rápido es fundamental.
* Búsqueda por nombre o SKU
* Filtros: Todos, Básico, Estampado, Réplica, Stock bajo (<= stock\_minimo), Sin stock
* Indicadores visuales: rojo si stock = 0, ámbar si stock <= stock\_minimo
* Resumen arriba: total unidades, valor a costo, valor a venta
* Botón para agregar variante nueva (formulario inline o pequeño, no modal gigante)

### 5\. Venta Rápida (LA FUNCIONALIDAD MÁS IMPORTANTE)

El flujo debe ser el más rápido y fluido posible. Es lo que se usa en el día a día en la tienda.

**Paso 1 — Buscar y agregar productos:**

* Input de búsqueda que filtra variantes con stock > 0
* Tap en un producto lo agrega al carrito
* Cada fila muestra: nombre, SKU, stock, precio sugerido
* Si tiene diseño, mostrar badge (ej: "Pulp Fiction")
* Carrito visible abajo con total y cantidad de ítems

**Paso 2 — Confirmar venta:**

* Lista de ítems del carrito
* Precio editable por ítem (se pre-llena con precio\_venta pero el usuario puede cambiarlo, porque en ORVANN los precios varían)
* Cantidad editable por ítem
* Método de pago: 4 opciones (Efectivo, Transferencia, Datáfono, Crédito)
* Responsable: 3 opciones (JP, Andrés, Kathe)
* Cliente: campo texto opcional
* Notas: campo texto opcional
* Botón "Confirmar venta"

**Paso 3 — Confirmación:**

* Pantalla de éxito con el total
* "Inventario actualizado automáticamente"
* Botones: "Nueva venta" o "Volver al inicio"

**Lógica de la venta (backend):**

1. Insertar fila en `ventas` (fecha, metodo\_pago, responsable, cliente, notas)
2. Insertar cada ítem en `items\_venta` (venta\_id, variante\_id, cantidad, precio\_unitario)
3. El trigger `fn\_venta\_descuenta\_stock` se encarga automáticamente de: verificar stock suficiente, descontar stock de la variante, registrar movimiento en `movimientos\_inv`
4. El trigger `fn\_actualizar\_total\_venta` calcula subtotal y total automáticamente

### 6\. NO hacer en esta sesión

* Auth/Login (acceso directo por ahora)
* CRUD de gastos
* Cierre de caja
* Transformaciones (estampado)
* Pedidos a proveedores
* Migración de datos históricos del Sheets

\---

## NOTAS TÉCNICAS

* Supabase SELECT retorna máx 1000 filas. El inventario de ORVANN son \~80-100 SKUs, no es problema por ahora.
* Formato moneda COP: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`. Nunca decimales.
* Fechas en formato colombiano: dd/mm/yyyy.
* El trigger de venta hace FOR UPDATE lock en la variante para prevenir race conditions.
* Las vistas v\_kpis\_mes, v\_inventario, v\_ventas\_detalle están en el schema.sql y se pueden usar directamente.

\---

## CRITERIOS DE ÉXITO

Al terminar esta sesión, debe ser posible:

1. Abrir la app en el celular (como PWA o en navegador móvil)
2. Ver dashboard con KPIs reales desde Supabase (aunque sean 0 inicialmente)
3. Ver inventario, buscar productos, filtrar por categoría
4. Editar campos del inventario inline (stock, precio, etc.)
5. Hacer el flujo completo: buscar producto → agregar al carrito → confirmar venta → ver stock descontado automáticamente en inventario
6. Deploy funcionando en Vercel

