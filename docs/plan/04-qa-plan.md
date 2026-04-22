# ORVANN Gestión — Plan de QA

Documento vivo que lista los casos de prueba de Fase 1. Se actualiza al terminar cada tarea con casos nuevos que dependen de lo construido. El QA completo se ejecuta al cerrar F1 antes del merge final a `main`.

Estados posibles: `pendiente` (no ejecutado aún) · `ok` · `fail` (con nota de qué falló) · `bloqueado` (esperando otra tarea o dato).

---

## Reglas del sistema de estampados (para validación)

El `costo_adicional` de una variante se calcula sumando conceptos de
`parametros_costo` según **tipo de producto** y **tipo de estampado**.

**Conceptos base** (siempre aplican si `aplicable_a` incluye el tipo):

| Concepto           | Monto  | Aplica a                          | Notas |
|--------------------|--------|-----------------------------------|-------|
| `etiqueta_espalda` | 600    | prenda                            | Etiqueta de tela en espalda |
| `marquilla_lavado` | 600    | prenda                            | Marquilla interna de lavado |
| `bolsa`            | 1000   | prenda / fragancia / accesorio    | Empaque al entregar |

**Conceptos por estampado** (se suman sobre los base):

| `tipo_estampado`          | Conceptos sumados                              | Extra |
|---------------------------|------------------------------------------------|-------|
| `ninguno`                 | —                                              | 0     |
| `punto_corazon_estampado` | `punto_corazon_estampado`                      | 2.000 |
| `punto_corazon_bordado`   | `punto_corazon_bordado`                        | 7.000 |
| `completo_dtg`            | `estampado_dtg_grande`                         | 12.000 |
| `doble_punto_y_completo`  | `estampado_dtg_grande` + `punto_corazon_estampado` | 14.000 |

**Ejemplos de `costo_adicional` (sobre costo_base)**:

| Tipo       | Estampado              | Desglose                          | Total |
|------------|------------------------|-----------------------------------|-------|
| prenda     | ninguno                | 600 + 600 + 1000                  | 2.200  |
| prenda     | completo_dtg           | 600 + 600 + 1000 + 12000          | 14.200 |
| prenda     | punto_corazon_estampado| 600 + 600 + 1000 + 2000           | 4.200  |
| prenda     | punto_corazon_bordado  | 600 + 600 + 1000 + 7000           | 9.200  |
| prenda     | doble_punto_y_completo | 600 + 600 + 1000 + 12000 + 2000   | 16.200 |
| fragancia  | ninguno                | 1000 (solo bolsa)                 | 1.000  |
| accesorio  | ninguno                | 1000 (solo bolsa)                 | 1.000  |
| otro       | ninguno                | (no hay bolsa aplicable)          | 0      |

**Cosas a validar contra el Sheet viejo** (si el costo está mal, me avisás y ajustamos):
- Que `punto_corazon_bordado` = 7.000 y `_estampado` = 2.000 (diferencia real entre bordar y estampar el logo de la espalda).
- Que `completo_dtg` = 12.000 sea el costo de la estampa grande (pecho, espalda o ambos).
- Que `doble_punto_y_completo` sea DTG grande + punto corazón estampado (14k) y **no** DTG + punto bordado (que sería 19k).
- Que `etiqueta_espalda` + `marquilla_lavado` sumen 1.200 siempre en prendas.
- Que la `bolsa` aplique a prendas, fragancias y accesorios (no a `otro`).

Si alguno de estos valores o reglas está mal, se corrige en el seed
(`supabase/seed.sql`) o en `src/lib/catalogo.ts`:
- **Cambio de precio**: `update parametros_costo set costo_unitario = N where concepto = 'X'`. Las variantes existentes **no** se recalculan (fotografía del costo al momento).
- **Nuevo concepto**: insert en `parametros_costo` + ajustar `CONCEPTO_CATEGORIA` y (si va por estampado) `ESTAMPADO_MAP` en `catalogo.ts`.
- **Cambio de qué estampado incluye qué concepto**: editar `ESTAMPADO_MAP` en `catalogo.ts`.

---

## Matriz por tarea

Cada fila es un caso. `Tipo`: `manual` (tester humano en UI) · `integration` (SQL sobre Supabase) · `unit` (función pura en TS).

### Setup / Tarea 1.1 — Schema

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| S-01 | integration | Schema aplicado completo | 9 migraciones corridas | `select count(*) from information_schema.tables where table_schema='public'` | 25 tablas | ok |
| S-02 | integration | RLS habilitado en todas | — | `select count(*) from pg_tables where schemaname='public' and rowsecurity=true` | 25 | ok |
| S-03 | integration | Seed correcto | Seed corrido | `select count(*) from disenos` / `proveedores` / `categorias_gasto` / `parametros_costo` | 39 / 3 / 17 / 6 | ok |
| S-04 | integration | Bucket comprobantes existe | 007_storage corrido | `select * from storage.buckets where id='comprobantes'` | 1 fila, public=false | ok |
| S-05 | integration | `fn_generar_sku` produce SKU válido | Productos y diseños cargados | `select fn_generar_sku((select id from productos limit 1), 'Negro', 'L', null)` | string no vacío, formato `XXX-NEG-L` | pendiente |
| S-06 | integration | `fn_calcular_distribucion_gasto` divide equitativa correctamente | 3 socios + 1 categoría | `insert into gastos (..., distribucion='equitativa', monto_total=90000)` | monto_kathe=30000, monto_andres=30000, monto_jp=30000 (o 30001 con el resto) | pendiente |
| S-07 | integration | Advisor sin errores | — | `get_advisors type=security` | 0 errors, sólo 24 warnings de RLS abierta (F2) | ok |
| S-08 | integration | GRANTs restauran acceso | migración 009 aplicada | `select count(*) from disenos` como authenticated | no `permission denied` | ok |
| S-09 | integration | Trigger auto-crea profile | migración 010 aplicada | Login de usuario nuevo → `select * from profiles where id=auth.uid()` | 1 fila con `rol='admin'` | ok (backfill JP verificado) |
| S-10 | integration | Enum estampado extendido (edge cases) | migración 011 aplicada | `select unnest(enum_range(null::tipo_estampado))` | 7 valores incluyendo `doble_bordado_y_completo` y `triple_completo` | ok |

### Tarea 1.2 — Frontend base

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| F-01 | manual | Build production | `.env.local` con keys | `npm run build` | Build exitoso, <500KB JS | ok |
| F-02 | manual | Lint sin errores | — | `npm run lint` | 0 errors | ok |
| F-03 | manual | Login redirige a /admin | Usuario creado en Supabase Auth | Login con credenciales válidas | Redirige a `/admin`, muestra Dashboard | ok (JP confirmó) |
| F-04 | manual | Login rechaza credenciales malas | — | Submit con password incorrecto | Error "Correo o contraseña incorrectos" | pendiente |
| F-05 | manual | Logout desde sidebar | Logueado | Click logout | Vuelve a pantalla de login | pendiente |
| F-06 | manual | Sidebar navegación | Logueado | Click cada ítem del sidebar | Navega + highlight activo correcto | pendiente |
| F-07 | manual | Responsive mobile sidebar | Viewport < 768px | Abrir menú hamburguesa | Sidebar slide-in, click ítem cierra el sheet | pendiente |
| F-08 | manual | Look & feel DURATA | Logueado | Comparar con `durata_crm` (mismo navegador) | Indistinguibles al ojo (tipografía, paleta, spacing) | ok (a primera vista, JP confirmó) |

### Tarea 1.3 — Catálogo

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| C-01 | manual | Listar diseños | Seed corrido + grants aplicados | Ir a `/admin/disenos` | 39 filas visibles, buscador filtra, filtro por categoría funciona | pendiente (re-test tras fix grants) — antes daba `permission denied for table disenos` |
| C-02 | manual | Crear diseño | — | Click "Nuevo diseño" + llenar form + guardar | Aparece en listado inmediatamente | pendiente |
| C-03 | manual | Editar diseño | C-02 OK | Click diseño recién creado, editar nombre | Nombre actualizado en listado | pendiente |
| C-04 | manual | Desactivar diseño | C-02 OK | Toggle "activo=false" | Desaparece del listado (filtro default oculta inactivos) | pendiente |
| C-05 | manual | Listar productos | — | Ir a `/admin/productos` | Lista paginada, buscador y filtro tipo funcionan | pendiente |
| C-06 | manual | Crear producto | Proveedor existe | "Nuevo producto" con nombre, tipo, proveedor | Aparece en listado, redirige a detalle | pendiente |
| C-07 | manual | Detalle de producto | C-06 OK | Click producto | Muestra datos + tabla de variantes (vacía al inicio) | pendiente |
| C-08 | manual | Editar producto | C-06 OK | Cambiar nombre y guardar | Actualiza en BD y en listado | pendiente |
| C-09 | manual | Crear variante con estampado | C-06 OK, parametros_costo en seed | Form variante: talla L, color Negro, estampado `completo_dtg`, costo_base 37000, precio 90000 | breakdown muestra 12000 + 600 + 600 + 1000 = 14200, costo_adicional=14200, SKU generado único | pendiente |
| C-10 | manual | Crear variante básica | C-06 OK | Form sin diseño, estampado `ninguno`, costo_base 37000, precio 75000 | costo_adicional=1000 (solo bolsa), SKU sin sufijo de diseño | pendiente |
| C-11 | unit | `calcularCostoAdicional` correcto | parametros_costo mock | `npm run test` | 14200 | ok |
| C-12 | unit | `calcularCostoAdicional` para accesorio | — | `npm run test` | 1000 (solo bolsa) | ok |
| C-13 | manual | SKU unicidad | C-09 OK | Crear otra variante con misma talla/color/diseño/producto | SKU con sufijo `-2` | pendiente |
| C-14 | integration | `fn_generar_sku` devuelve único | Variantes existentes | `select fn_generar_sku(...)` con datos que ya existan | sufijo numérico | pendiente |
| C-15 | manual | Listar variantes con filtros | Varias variantes creadas | `/admin/variantes`, filtrar por stock bajo, sin imagen | Filtros aplican correctamente | pendiente |
| C-16 | manual | Subir imagen a variante | Variante existe | Click "Subir imagen" en detalle | Imagen comprimida <1MB, se guarda en Storage, URL en `variantes.imagen_url` | bloqueado (Tarea 1.3b: upload imagen posponer hasta tener variantes reales) |
| C-17 | manual | CSV: importar 20 variantes válidas | Template CSV | Upload CSV en `/admin/variantes` | Reporte "20 OK, 0 fallidas", variantes creadas | pendiente |
| C-18 | manual | CSV: fila inválida | CSV con fila sin precio_venta | Upload | Reporte muestra fila problemática, resto se crea | pendiente |
| C-19 | manual | CSV/XLSX: producto nuevo find-or-create | archivo con producto_base no existente | Upload | Crea producto + variante, movimiento `entrada_pedido` con cantidad inicial | ok (one-shot: 12 productos creados desde xlsx real de JP) |
| C-20 | integration | Stock cache tras import | C-19 OK | `select stock_cache from variantes` | = cantidad inicial | ok (55 unidades totales en 41 variantes, stock_cache mantenido por trigger) |
| C-21 | manual | XLSX real de JP importado | `docs/referencia/inventario-fisico-template.xlsx` | Script `scripts/preparar-import-jp.mjs` + `generar-sql-import.mjs` + MCP | 41 variantes, 55 unidades | ok (parcial: import one-shot hecho; el importer UI requiere ajustes) |
| C-22 | manual | Headers con espacios/acentos | XLSX con "Precio Venta" o "Diseño" | Upload desde UI | Preview muestra `"precio_venta ← de 'Precio Venta'"` y importa | pendiente (normalización ya en código, falta end-to-end UI) |
| C-23 | manual | Alias de headers | CSV con `precio` en vez de `precio_venta` | Upload UI | Mapea por `HEADER_ALIASES` | pendiente |
| C-24 | manual | Diseño no existente | archivo con `diseno="No Existe"` | Upload | Fila falla con mensaje "Diseño X no existe" | pendiente |
| C-25 | integration | Inventario real 50% cargado | — | `select count(*) from productos; variantes; movimientos` | 13 productos, 87 variantes, 87 movimientos, 127 unidades | ok |
| C-26 | known-issue | Importer UI vs. formato JP | Excel real usa 3 cols SI/NO para estampado + header en row 2 | — | Sub-tarea **1.3c**: extender importer UI para detectar header row auto y mapear SI/NO→enum. Por ahora se usa script one-shot. | bloqueado (diferido a 1.3c) |
| C-27 | integration | wipe-import idempotente | variantes importadas sin ventas | Correr `scripts/wipe-import.sql` 2 veces | Primera vez borra todo; segunda vez deja 0/0/0 | ok (verificado) |
| C-28 | integration | Script consolida duplicados por (producto/color/talla/diseño/estampado) | xlsx con filas repetidas | `preparar-import-jp.mjs` con dedup | Antes: 106 variantes con 35 sufijos; después dedup: 87 variantes con 17 sufijos residuales (colisiones de SKU slug por diseños similares) | ok con nota |
| C-29 | known-issue | SKUs con sufijo `-2/-3` por colisión de slug | 2 diseños con mismas primeras 4 letras | `fn_generar_sku` agrega sufijo | ~17 de 87 variantes tienen sufijo. JP puede editar nombres o ignorar. | bloqueado (mejorar `fn_generar_sku` en F2) |

### Tarea 1.4 — Pedidos a proveedor

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| P-01 | manual | Crear pedido con 5 items (descripción libre) | Proveedor existe | `/admin/pedidos/nuevo`, agregar 5 items sin variante | Pedido creado, estado `pendiente`, redirige a detalle | pendiente |
| P-02 | manual | Marcar pago | P-01 OK | Click "Marcar pagado" → modal con fecha | `estado_pago='pagado'`, `fecha_pago` guardada, badge verde | pendiente |
| P-03 | manual | Mapear item antes de recepción | P-01 OK | Click ícono ↻ en fila sin mapear, seleccionar variante del buscador | `pedidos_proveedor_items.variante_id` seteado | pendiente |
| P-04 | manual | Recepción guiada (parcial mapeada) | P-01 + 2 items mapeados | Click "Registrar recepción" → modal fecha → confirmar | Warning "N sin mapear no afectan stock", confirmación OK | pendiente |
| P-05 | integration | `fn_post_recepcion_pedido` trigger | P-04 OK | `select * from movimientos_inventario where referencia_id=<pedido_id>` | N filas `entrada_pedido` sólo para items con variante_id | pendiente |
| P-06 | integration | Stock suma tras recepción | P-05 OK | `select stock_cache from variantes where id in (items mapeados)` | +unidades del pedido en cada una | pendiente |
| P-07 | manual | Filtro por proveedor | Varios pedidos de distintos proveedores | `/admin/pedidos` con filtro | Solo los del proveedor | pendiente |
| P-08 | manual | Filtro por mes | Pedidos en distintos meses | Selector month-input | Solo los del mes | pendiente |
| P-09 | manual | Total recalculado | Pedido con items editados | Click "Recalcular total" si hay diff | `pedidos.total` = suma de items | pendiente |
| P-10 | manual | Recepción bloqueada 2x | P-04 ya OK | Intentar recepción de nuevo | Botón "Registrar recepción" oculto porque ya tiene fecha | pendiente |

### Tarea 1.5 — POS móvil con pagos mixtos y devoluciones

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| V-01 | manual | Login POS móvil | Vendedor creado en Supabase | En celular abrir `/pos`, login | Redirige a grilla de productos | pendiente |
| V-02 | manual | Instalar PWA | V-01 OK | "Agregar a pantalla de inicio" en Chrome/Safari | Instala, icono ORVANN visible | pendiente |
| V-03 | manual | Grilla responsive | V-01 OK | Rotar/cambiar viewport | 2 columnas móvil, 4 tablet | pendiente |
| V-04 | manual | Buscar variante | Variantes con SKU/nombre | Tipear en buscador | Filtra en vivo | pendiente |
| V-05 | manual | Agregar al carrito | V-01 OK | Tap variante, "Agregar a venta" | Badge del carrito suma 1 | pendiente |
| V-06 | manual | Pago efectivo con vueltas | Carrito con total 85000 | Método efectivo, efectivo_recibido=100000 | Vueltas=15000 correcto, guarda en `ventas.vueltas` | pendiente |
| V-07 | manual | Pago mixto (3 métodos) | Carrito total 100000 | 30000 efectivo + 50000 transferencia (con foto) + 20000 datáfono | Se crean 3 filas en `venta_pagos`, foto visible en admin, total cuadra | pendiente |
| V-08 | manual | Descuento global | Carrito total 100000 | Aplicar descuento 10000, motivo "cliente frecuente" | Total=90000, `descuento_motivo` guardado, venta_pagos valida 90000 | pendiente |
| V-09 | manual | Devolución parcial | Venta V-07 existe | Menú "Devoluciones", buscar, seleccionar 1 de 2 items, confirmar | Nueva venta `tipo_transaccion='devolucion'`, stock del item devuelto sube | pendiente |
| V-10 | manual | Cambio de talla | Venta con camisa M | "Cambio", devolver M, llevar L, diferencia de precio | 2 filas `ventas` vinculadas por `venta_original_id`, neto correcto | pendiente |
| V-11 | integration | `fn_post_venta_item` emite movimiento correcto | V-07 OK | `select * from movimientos_inventario where referencia_id=<venta>` | N filas negativas (una por item) | pendiente |
| V-12 | integration | Trigger devolución | V-09 OK | `select * from movimientos_inventario where referencia_tipo='devolucion'` | 1 fila positiva del item devuelto | pendiente |
| V-13 | integration | `fn_validar_pagos_venta` rechaza venta descuadrada | — | Intentar venta con suma pagos < total y estado completada | raise exception | pendiente |
| V-14 | manual | Stock cuadra tras 10 ventas | 10 ventas variadas | Conteo físico vs `stock_cache` | diferencia = 0 | pendiente |
| V-15 | manual | Banner sin conexión | V-01 OK | Desactivar WiFi/datos | Banner rojo "Sin conexión", grilla sigue visible | pendiente |
| V-16 | manual | Reconexión catálogo | V-15 OK | Reactivar red | Banner desaparece, venta se habilita | pendiente |
| V-17 | manual | Cliente existente | Cliente creado desde otra venta | En cobro, buscar por teléfono | Autocompleta datos | pendiente |
| V-18 | manual | Cliente nuevo al vuelo | — | En cobro, "Crear cliente" con nombre+tel | Cliente creado, asociado a la venta | pendiente |
| V-19 | integration | Cache cliente actualizado | V-18 OK | `select total_comprado_cache, num_compras_cache from clientes where id=...` | Suma correcta | pendiente |

### Tarea 1.6 — Gastos

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| G-01 | manual | Crear gasto equitativo 90k | Categoría Arriendo existe | Form: monto 900000, equitativa, pagador ORVANN | monto_kathe=300000, monto_andres=300000, monto_jp=300000 | pendiente |
| G-02 | manual | Crear gasto asignado a KATHE | — | Form: monto 150000, asignada, pagador KATHE | monto_kathe=150000, otros=0 | pendiente |
| G-03 | manual | Crear gasto ORVANN | — | Form: monto 50000, orvann, pagador ORVANN | monto_orvann=50000, socios=0 | pendiente |
| G-04 | manual | Validación suma custom | — | Form custom con montos que no cuadran | Zod impide submit con mensaje claro | pendiente |
| G-05 | manual | Listado con totales al pie | G-01, G-02, G-03 OK | Ver listado | Totales por socio y ORVANN correctos | pendiente |
| G-06 | manual | Filtros por rango y categoría | Gastos variados | Filtrar por mes y categoría | Tabla actualiza | pendiente |
| G-07 | manual | Export CSV | G-05 OK | Click "Exportar CSV" | Download con datos filtrados | pendiente |

### Tarea 1.7 — Clientes

| # | Tipo | Caso | Pre-condiciones | Pasos | Resultado esperado | Estado |
|---|------|------|-----------------|-------|--------------------|--------|
| K-01 | manual | Listar clientes | Clientes creados desde POS | `/admin/clientes` | Tabla con total_comprado, num_compras | pendiente |
| K-02 | manual | Detalle cliente con historial | K-01 OK | Click cliente | Datos + tabla de ventas del cliente | pendiente |
| K-03 | manual | Buscar por teléfono | — | Tipear parte de un tel | Filtra correctamente | pendiente |

---

## Pruebas end-to-end (release gate)

Estos escenarios cubren el flujo completo. Se ejecutan al cerrar Fase 1:

**E2E-01 — Carga inicial del inventario**
1. JP sube CSV con 50 variantes reales.
2. Verificar que 50 variantes existen con stock inicial correcto.
3. Verificar que aparecen productos nuevos creados por find-or-create.

**E2E-02 — Flujo completo de 10 ventas**
1. Prima abre POS en celular, login.
2. Completa 10 ventas variadas:
   - 3 efectivo simple (con cliente, sin cliente, cliente nuevo)
   - 3 transferencia con foto
   - 2 pago mixto
   - 1 con descuento
   - 1 cancelada (anular durante el día)
3. Stock cache cuadra con conteo físico manual.
4. Cierre: `cierres_caja` del día muestra los totales correctos por método.

**E2E-03 — Devolución parcial + cambio**
1. Del E2E-02, tomar 1 venta con 2 items.
2. Devolver 1 ítem, verificar stock vuelve.
3. Cambiar otro ítem por uno diferente, verificar vinculación `venta_original_id`.

**E2E-04 — Pedido a proveedor con recepción**
1. Crear pedido de 20 items (15 con variante existente, 5 libres).
2. Marcar pago.
3. Al recibir, mapear los 5 libres creando variantes al vuelo.
4. Verificar stock subió en las 20 variantes.

**E2E-05 — Gastos de un mes**
1. Registrar 20 gastos variados (equitativos/asignados/orvann).
2. Totales por socio cuadran con Sheet de referencia.
3. Export CSV se abre correctamente en Excel/Numbers.

---

## Pruebas de performance (F1 no bloqueante)

- Tiempo de carga de `/admin/variantes` con 500 variantes: <1s.
- Tiempo para completar 1 venta en POS (tap → confirmado): <10s.
- Tiempo para importar CSV de 100 variantes: <5s.

---

## Pruebas de seguridad

- [ ] La anon key **no** está commiteada al repo (ver `.gitignore` cubre `.env.local`).
- [ ] La service_role key **no** se usa en código cliente.
- [ ] Policies RLS abiertas F1 sólo permiten a `authenticated` (no `anon`).
- [ ] Al cerrar F2/F3, vendedor no puede SELECT costos/gastos (re-ejecutar esta checklist).

---

## Notas del ejecutor de QA

Cuando se ejecute el QA completo (antes del merge F1 → main), el tester:
1. Clona la branch `v2` limpia.
2. Corre `npm install` + `npm run build` + `npm run lint`.
3. Levanta la app, se loguea con un usuario de prueba.
4. Ejecuta cada caso en orden. Marca estado + nota de observación.
5. Si un caso falla bloqueante, pausa y reporta. Los no bloqueantes se registran y se discuten.

Los casos `integration` se pueden correr con `mcp__..._execute_sql` o desde SQL Editor de Supabase. Los `unit` con `npm test` (tests a agregar en Tarea 1.3+ según convenga).
