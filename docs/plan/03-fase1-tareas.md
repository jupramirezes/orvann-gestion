# ORVANN Gestión — Fase 1, tareas y protocolo de ejecución

Este documento guía la ejecución de la Fase 1. Asume `01-modelo-datos.md` y `02-plan-fases.md` ya leídos y aprobados. El modelo incluye todos los cambios ya consolidados (pagos mixtos, devoluciones, descuentos, offline-cache, etc.).

---

## Decisiones tomadas (base del plan)

| # | Decisión | Aplicación |
|---|----------|-----------|
| 1 | **Devoluciones modelo A**: nueva fila `ventas` con `tipo_transaccion='devolucion'` + `venta_original_id`. Cambio = devolución + venta nueva vinculadas. | Trigger `fn_post_venta_item` lee tipo y emite movimiento con signo correcto. Mejor trazabilidad y reportería. |
| 2 | **Stack UI**: estilo visual y UX idénticos a DURATA, pero las librerías se eligen por función. | Se agregan `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `browser-image-compression`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`. **No** se agregan `sonner` ni `@tanstack/react-query` (se porta `Toast.tsx` de DURATA y se usa `supabase-js` directo). |
| 3 | **Migraciones vía MCP Supabase**. | Claude Code aplica con `apply_migration`, no con `execute_sql`. Cada archivo es una migración trackeable. |
| 4 | **Socios 33.3% cada uno** (suma 99.9, informativo en `profiles.porcentaje_sociedad`). | El cálculo de distribución equitativa no depende del campo: el trigger parte `monto_total / 3` y ajusta ±1 peso para cuadrar. |
| 5 | **Enum `pagador_gasto`**: ORVANN / KATHE / ANDRES / JP. | Agregar socios nuevos vía `alter type ... add value`. |
| 6 | **Enum `cuenta_consignacion`**: ahorros_orvann / corriente_orvann / nequi_orvann / daviplata_orvann / otro. | Extensible por `alter type`. |
| 7 | **`ventas.shopify_order_id` unique** + índice. | Evita duplicados de sync F4. |
| 8 | **No se agrega `variantes.zona`** (ubicación física). | Las prendas rotan mucho; agregaría ruido sin valor. |
| 9 | **Limpieza completa** del repo y del proyecto Supabase antes de arrancar (ver §Estado inicial). | Branch `v2` nace limpio; Supabase `nldctykjvyqsggwvweeh` se resetea. |
| 10 | **Logo**: `docs/imagenes/ORVANN.png`. | Se usa en login del POS y en el topbar del admin. |

---

## Stack y convenciones

- **Frontend**: React 19 + TypeScript estricto + Tailwind v4 + Vite.
- **DB + Auth + Storage**: Supabase (`nldctykjvyqsggwvweeh`).
- **Deploy**: Vercel.
- **PWA**: manifest + service worker. POS instalable en Android/iOS.
- **Tipos de DB**: generados por `supabase gen types typescript --project-id nldctykjvyqsggwvweeh > src/types/database.ts`. Cada vez que cambie el schema, regenerar.
- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`. Sin `any` sin comentario de justificación.
- **Naming**: tablas y columnas en snake_case español (definido en el modelo). Componentes en PascalCase inglés (Button, ProductGrid). Archivos de lógica de dominio en camelCase español (calcularDistribucionGasto, generarSku).
- **Git**: branch `v2` para todo Fase 1. Una tarea = un branch + un PR con nombre `v2-f1-{num}-{slug}` (ej. `v2-f1-1.3-catalogo`). Commits atómicos en español imperativo ("agrega tabla variantes", no "agregando" ni "added").
- **Antes de cada commit**: `npm run build`, `npm run lint`, typecheck OK. Nada roto se commitea.
- **Queries tipadas** con los tipos generados. Listados paginados en servidor, no en memoria.
- **Tests F1**: sólo en funciones de negocio puras (generar SKU, distribuir gasto, calcular costo adicional). No UI tests en F1.

---

## Estado inicial del repo y limpieza previa

El repo actual en `dev` tiene un intento v1 descartado (schemas SQL sueltos, 5 pages con tema oscuro). Hay que limpiar antes de construir v2.

### Archivos/carpetas a borrar en la primera limpieza de `v2`
- `schema_01_tablas.sql`, `schema_02_triggers_vistas.sql` (raíz) — reemplazados por `supabase/migrations/`.
- `src/pages/Caja.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Gastos.tsx`, `src/pages/Inventario.tsx`, `src/pages/VentaRapida.tsx` — tema oscuro, reemplazados por páginas nuevas.
- `src/components/Layout.tsx` (v1) — reemplazado por `AdminLayout` y `POSLayout` heredados de DURATA.
- `src/index.css` con `--color-bg: #0a0a0a` — reemplazado por el tema claro de DURATA.
- `ORVANN_SESION_1.md` (raíz) — archivo de sesión inicial v1; ya no aplica.
- `scripts/seed-variantes.ts` — verificar contenido; si es del v1, borrar.
- `dist/` — build antigua; `.gitignore` ya lo cubre pero queda en disco.

### Proyecto Supabase
- `nldctykjvyqsggwvweeh` está actualmente **INACTIVE** (paused). Hay que reactivarlo antes de aplicar migraciones.
- Reset completo del schema `public` en la primera migración (`000_reset.sql`).

---

## Protocolo de trabajo

1. **Un checkpoint a la vez**. No avanzar al siguiente sin OK explícito de JP. Si una decisión afecta tareas posteriores, preguntar antes.
2. **Cada tarea = un branch + un PR** a `v2`. Merge solo con aprobación.
3. **Migraciones por MCP Supabase**: `mcp__..._apply_migration` con `name` descriptivo (ej. `001_enums`). `execute_sql` sólo para SELECT de verificación; NUNCA para DDL destructivo sin OK.
4. **Reportes**: al terminar cada tarea, responder con: qué se hizo, commits, archivos tocados, cómo verificar, preguntas abiertas para la siguiente.
5. **Si algo no está claro**, preguntar. Mejor 10 preguntas que construir algo que hay que tirar.

---

## Tarea 1.1 — Reset y schema en Supabase

Crear los 8 archivos SQL + README en `supabase/` y aplicarlos en orden vía MCP.

### Archivos
```
supabase/
├── README.md                              # warning RLS abiertas + orden de ejecución
└── migrations/
    ├── 20260421_000_reset.sql             # drop schema public cascade
    ├── 20260421_001_enums.sql             # enums del modelo
    ├── 20260421_002_tables.sql            # tablas en orden de dependencias
    ├── 20260421_003_functions.sql         # 10 funciones (ver modelo)
    ├── 20260421_004_triggers.sql          # triggers que invocan funciones
    ├── 20260421_005_indexes.sql           # índices del modelo
    ├── 20260421_006_rls.sql               # enable RLS + policies abiertas
    └── 20260421_007_storage.sql           # bucket comprobantes + policies
└── seed.sql                               # proveedores, categorías, parámetros, diseños
```

### Ejecución
1. JP reactiva el proyecto Supabase (UI dashboard, "Restore project").
2. Claude Code corre `mcp__..._list_tables` para ver el estado actual.
3. Claude Code aplica migraciones en orden con `apply_migration`. Si alguna falla, se corrige y se re-aplica.
4. Se verifica con `mcp__..._list_tables` (esperamos ~22 tablas) y `mcp__..._get_advisors type=security` (esperamos sólo warnings de RLS abiertas, ya documentados).
5. Seed final vía `execute_sql` o `apply_migration`.

### Checkpoint 1.1
- Todas las tablas existen.
- Inserts de seed corren sin error.
- `get_advisors` no reporta errores (sólo warnings esperados de RLS).

---

## Tarea 1.2 — Configuración base del frontend

1. Actualizar `package.json` con dependencias listadas en §Stack.
2. Configurar `src/lib/supabase.ts` espejo del de DURATA.
3. Generar `src/types/database.ts` con `supabase gen types`.
4. Copiar componentes base de DURATA (`ui.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Toast.tsx`, `Login.tsx` como referencia), `src/lib/utils.ts`, tokens CSS de `src/index.css`.
5. Configurar router con `AdminLayout` (sidebar + topbar) y `POSLayout` (mínimo, sin sidebar).

### Checkpoint 1.2
- `npm run dev` levanta en `/` con sidebar DURATA-like y placeholders.
- Login funciona con usuario de prueba de Supabase Auth.
- Si algo no se ve idéntico a DURATA, parar y preguntar antes de seguir.

---

## Tarea 1.3 — Catálogo (Admin)

Rutas: `/admin/productos`, `/admin/productos/:id`, `/admin/disenos`, `/admin/variantes`.

1. Listado productos con buscador, filtro por tipo, paginación server.
2. Detalle producto: edición, imagen, lista de variantes.
3. Crear variante: form con talla/color/diseño/estampado; `costo_adicional` se calcula desde `parametros_costo` y se muestra breakdown antes de guardar.
4. Listado global variantes con filtros (stock bajo, sin imagen, activas/inactivas).
5. Importación CSV: endpoint `POST /api/admin/variantes/importar`. Valida columnas del template (`tipo, producto_base, color, talla, diseno, estampado, cantidad, costo_unit, precio_venta, observacion`). Crea productos con find-or-create, variantes, y un movimiento `entrada_pedido` por `cantidad` inicial.

### Checkpoint 1.3
- 3 productos + 5 variantes cada uno (2 básicas y 1 estampada) creados manualmente, costos calculan bien.
- CSV de 20 variantes importado con reporte de éxito/fallo.

---

## Tarea 1.4 — Pedidos a Proveedor (Admin)

Rutas: `/admin/pedidos`, `/admin/pedidos/:id`, `/admin/pedidos/nuevo`.

1. Listado con filtros (proveedor, estado_pago, mes).
2. Crear pedido con items (descripción libre + unidades + costo; opcional `variante_id`).
3. Marcar pago (estado + fecha).
4. Recepción guiada: modal por item sin mapear, buscar variante o crear al vuelo. Trigger emite movimientos de inventario al setear `fecha_recepcion`.

### Checkpoint 1.4
- Pedido de 20 items, recepción mapea 15 a variantes existentes y 5 crea nuevas, `stock_cache` sube correctamente en las 20.

---

## Tarea 1.5 — POS Móvil (PWA) completo

Ruta: `/pos`.

1. PWA: `manifest.json` con nombre "ORVANN POS", iconos desde `docs/imagenes/ORVANN.png`, theme_color DURATA, display `standalone`, start_url `/pos`. Service worker con cache de assets estáticos.
2. Login: pantalla centrada con logo + email/password + submit a Supabase Auth.
3. Pantalla principal POS: topbar, grilla de variantes activas, buscador, chips por tipo.
4. Modal detalle variante con precio editable.
5. Carrito.
6. **Pantalla de cobro con pagos mixtos**:
   - Lista de N pagos. Cada pago: método + monto + referencia opcional + foto opcional (transferencia/datáfono).
   - Total / pagado / saldo visibles. Confirmación bloqueada hasta pagado=total.
   - Descuento global con motivo obligatorio.
   - Efectivo: input `efectivo_recibido` + vueltas.
   - Cliente opcional (buscar/crear).
7. **Devoluciones/cambios** (menú separado): buscar venta, seleccionar items, método de reintegro, confirmar.
8. **Offline cache**: catálogo en IndexedDB, banner sin conexión, ventas sólo online.
9. Post-confirmación: toast, opción "Nueva venta".

### Checkpoint 1.5
- PWA instalada en celular.
- 10 ventas por vendedor sin asistencia.
- Venta con pago mixto 30k efectivo + 50k transferencia con foto + 20k datáfono: 3 filas en `venta_pagos`, foto visible en admin.
- Devolución parcial: stock vuelve sólo del item devuelto.
- Cambio con diferencia de precio.
- Efectivo recibido > total: vueltas correctas.
- Descuento global con motivo.
- Banner sin conexión al desconectar red.

---

## Tarea 1.6 — Gastos (Admin)

Rutas: `/admin/gastos`, `/admin/gastos/nuevo`.

1. Form con todos los campos. Reactivo: al cambiar `distribucion`, los inputs de monto por socio se habilitan/deshabilitan y recalculan.
2. Validación `zod` de la suma (±1 peso).
3. Listado con filtros (rango, categoría, pagador). Totales al pie (general / por socio / ORVANN).
4. Exportación CSV.

### Checkpoint 1.6
- 20 gastos variados (equitativos / asignados / orvann) con cálculos correctos.

---

## Tarea 1.7 — Clientes (Admin)

Rutas: `/admin/clientes`, `/admin/clientes/:id`.

1. Listado: nombre, teléfono, num_compras, total_comprado, última compra. Buscador.
2. Detalle: datos + historial de compras.

### Checkpoint 1.7
- Detalle de un cliente creado desde POS muestra su compra.

---

## Qué se necesita de JP para arrancar

1. **Reactivar el proyecto Supabase** `nldctykjvyqsggwvweeh` desde el dashboard de Supabase (botón "Restore project"). Esto es manual; el MCP no reactiva proyectos pausados.
2. **Confirmar que el proyecto no tiene datos reales** que haya que preservar (el reset drop schema es destructivo). Si hay algo, exportar primero.
3. **OK para arrancar Tarea 1.1** (crear branch `v2` desde `main`, limpiar archivos v1, aplicar migraciones por MCP).
4. Más adelante (Tarea 1.2): un token de acceso de Supabase para `supabase gen types` — lo pido cuando toque.
5. **Inventario físico** en CSV cuando esté listo (sigue el template `docs/referencia/inventario-fisico-template.csv`).

---

## Operación: flujos de trabajo frecuentes

### Cómo se calcula el costo de una variante

`costo_total = costo_base + costo_adicional`:
- **`costo_base`**: lo que cuesta la prenda pelada del proveedor (entrada manual).
- **`costo_adicional`**: se **fotografía** al crear la variante sumando conceptos aplicables de `parametros_costo` según (`tipo_producto`, `tipo_estampado`):

**Base (siempre que `aplicable_a` incluya el tipo)**:
| Concepto | Monto | Aplica a |
|----------|-------|----------|
| `etiqueta_espalda` | 600 | prenda |
| `marquilla_lavado` | 600 | prenda |
| `bolsa` | 1000 | prenda/fragancia/accesorio |

**Por estampado** (suma sobre base):
| `tipo_estampado` | Conceptos extra | Suma extra |
|------------------|-----------------|-----------:|
| `ninguno` | — | 0 |
| `punto_corazon_estampado` | estampado | 2.000 |
| `punto_corazon_bordado` | bordado | 7.000 |
| `completo_dtg` | DTG | 12.000 |
| `doble_punto_y_completo` | DTG + estampado | 14.000 |
| `doble_bordado_y_completo` | DTG + bordado | 19.000 |
| `triple_completo` | DTG + estampado + bordado | 21.000 |

Resultado total para prenda con ese estampado = base (2.200) + extra. Ejemplo: prenda `doble_punto_y_completo` → 2.200 + 14.000 = **16.200**. Verificable en `src/lib/catalogo.test.ts`.

### Cómo se agrega inventario nuevo (compras al proveedor)

1. **Crear pedido**: `/admin/pedidos/nuevo` — elegís proveedor, fecha, y agregás items. Cada item puede ser:
   - **Variante existente** (dropdown con las 41 que ya tenés). Usado para re-compras.
   - **Descripción libre** ("10 camisas Boxy M negras nuevas"). Se usa cuando llegan productos que aún no existen como variante.
2. **Marcar pagado** (opcional): modal con fecha → `estado_pago='pagado'`.
3. **Mapear items libres antes de recepción**:
   - Si el item era descripción libre y la variante **ya existe**: click ↻ en la fila → buscador → seleccionar.
   - Si es una variante **nueva**: crearla primero en `/admin/productos/:id` → "Nueva variante" (con costo + precio). Después mapear el item del pedido a esa variante recién creada.
4. **Registrar recepción**: botón "Registrar recepción" → modal con fecha → confirmar. Esto dispara el trigger `fn_post_recepcion_pedido` que inserta un `movimiento_inventario` tipo `entrada_pedido` por cada item con `variante_id`. El `stock_cache` de cada variante se incrementa automáticamente.
5. **Items sin mapear** quedan en el pedido pero **no afectan stock** (warning amarillo en el detalle). Se pueden mapear después editando el item — pero el stock no se re-dispara (el trigger solo corre al pasar `fecha_recepcion` de null a date). Para esos casos: crear un `movimiento_inventario` `ajuste_positivo` manual, o cancelar y re-recibir.

### Re-importar inventario desde xlsx (actualización de JP)

Cuando JP actualice el Excel con más filas del inventario físico:

1. **Guardar el xlsx** en `docs/referencia/inventario-fisico-template.xlsx` (reemplaza el existente).
2. **Wipe previo** (opcional, solo si querés reemplazar el dataset): correr `scripts/wipe-import.sql` por MCP. Borra solo las variantes que tienen únicamente `movimiento referencia_tipo='import_inicial'` y sin ventas asociadas. Las que ya tienen venta se **conservan** para no romper histórico (y el re-import les pone sufijo `-2`).
3. **Preparar payload**: `node scripts/preparar-import-jp.mjs > tmp-import/payload.json` — lee el xlsx, mapea columnas SI/NO a enum, incluyendo los nuevos edge cases `doble_bordado_y_completo` y `triple_completo`.
4. **Generar SQL**: `node scripts/generar-sql-import.mjs` — produce `tmp-import/import.sql`.
5. **Aplicar por MCP**: los chunks se pasan a `execute_sql` o `apply_migration`. El stock_cache se actualiza por trigger automáticamente al insertar los movimientos.

**Futuro (1.3c)**: el importer UI detectará automáticamente el formato de JP (header en row 2, columnas SI/NO) para que pueda re-importar desde el admin sin scripts.

---

## Referencias

- `01-modelo-datos.md` — schema completo (fuente de verdad).
- `02-plan-fases.md` — fases y criterios.
- `seed-disenos.sql` — 39 diseños culturales.
- `docs/referencia/inventario-fisico-template.csv` — contrato de columnas del importador.
- `docs/imagenes/ORVANN.png` — logo.
- Repo DURATA: `C:\Personal\Negocios\DURATA\durata_crm` — referencia visual y de patrones de código.
- Sheet original: solo referencia histórica, NO se migra mecánicamente.
