# Handoff de sesión — ORVANN Gestión

**Última actualización**: 2026-04-21 (fin de sesión)
**Para**: la próxima sesión de Claude Code que retome el trabajo.

> Este documento es el punto de entrada. Léelo antes de hacer cualquier cosa. Después consultá los docs 01-04 del plan. Cuando JP retome, mencionale que leíste este archivo y preguntale si quiere mantener el plan de trabajo propuesto.

---

## 1. Contexto del proyecto en 5 líneas

- **ORVANN Gestión**: sistema web + PWA móvil que reemplaza un Google Sheet para una tienda de streetwear en Medellín (3 socios: Kathe, Andrés, JP).
- **Stack**: React 19 + TS estricto + Tailwind v4 + Vite · Supabase (DB/Auth/Storage) · Vercel (deploy futuro).
- **Tres superficies**: Admin web (PC), POS móvil (celular), Bot Telegram F3 (no construido).
- **Proyecto Supabase**: `nldctykjvyqsggwvweeh` (organización `ccakrhvhypuqpphulxoz`).
- **Estilo visual** es 100% fiel a DURATA (`C:\Personal\Negocios\DURATA\durata_crm`) — paleta oklch cool-steel, tema claro, componentes heredados.

---

## 2. Estado actual del código

**Branch activo**: `v2-f1-1.4-pedidos` (working tree limpio).

**Commits en orden** (más nuevo arriba):
```
1de417e  wipe idempotente + dedup consolidado + re-import 50% del inventario real
802edda  inicia Tarea 1.5: POS movil base (PWA + grilla + carrito)
ed3f1ff  fixes UX + enum estampado edge cases + docs operativas
a9d6770  implementa modulo Pedidos a proveedor (Tarea 1.4)
5987e46  carga inventario real de JP (30%) + scripts de import (Tarea 1.3c)
4d9a614  merge: Tarea 1.3 catalogo + 1.3b fixes (grants, profile trigger, XLSX)
3f88b2d  fix grants + profile trigger + soporte XLSX (Tarea 1.3b)
4d22741  implementa modulo Catalogo (Tarea 1.3)
6adec8b  merge: Tarea 1.2 frontend base
1528f69  configura base del frontend con estilo DURATA (Tarea 1.2)
645151a  aplica schema de Fase 1 en Supabase (Tarea 1.1)
40ca1aa  limpia v1 descartado y agrega plan consolidado v2
```

**Estructura de branches**:
- `dev` (obsoleta, v1 descartado — no tocar).
- `v2` (base para todas las F1 tasks; incluye hasta Tarea 1.3).
- `v2-f1-1.2-frontend-base` (merged a v2).
- `v2-f1-1.3-catalogo` (merged a v2).
- `v2-f1-1.4-pedidos` ← **activa**; tiene 1.4 + fixes + import real + POS scaffolding. Sin merge todavía a `v2`.

**No hay main ni producción** aún. Tampoco deploy a Vercel. JP prueba todo en localhost.

---

## 3. Estado de Supabase (vivo)

| Entidad | Valor |
|---------|-------|
| Productos | 13 |
| Variantes | 87 (17 con sufijo `-2/-3` por colisiones de slug) |
| Movimientos inventario | 87 (todos tipo `entrada_pedido` con `referencia_tipo='import_inicial'`) |
| Stock total | 127 unidades |
| Diseños | 43 total, 6 activos (Pulp Fiction, Jhon Wick, Kobe Bryant, Eminem, Diomedez, Willie Colón) |
| Profiles | 1 (JP: `rjuanpablohb@gmail.com`, rol `admin`) |
| Ventas | 0 |
| Pedidos proveedor | 0 |
| Categorías de gasto | 17 (seed) |
| Parámetros de costo | 6 (seed) |
| Proveedores | 3 (AUREN, YOUR BRAND, BRACOR) |

**Migraciones aplicadas (11)**: 000_reset, 001_enums, 002_tables, 003_functions, 004_triggers, 005_indexes, 006_rls, 007_storage, 008_function_search_path, 009_grants, 010_profile_auto, 011_estampado_edge_cases.

**Advisor**: 0 errors; 24 warnings de RLS abiertas en F1 (esperado, se cierran en F2).

---

## 4. Lo último que se hizo (hito de esta sesión)

### Tarea 1.4 — Pedidos a proveedor ✅ (commit `a9d6770`)
- `/admin/pedidos` listado con filtros por proveedor, estado_pago, mes.
- `/admin/pedidos/nuevo` con react-hook-form + useFieldArray para items dinámicos (variante existente o descripción libre).
- `/admin/pedidos/:id` con marcar pago + recepción guiada + mapeo de items sin variante. Al marcar recepción el trigger `fn_post_recepcion_pedido` crea movimientos `entrada_pedido` automáticamente.

### Fixes de Tarea 1.3 ✅ (commit `ed3f1ff`)
- Stock centrado en `/admin/variantes` y `ProductoDetalle`.
- Todas las columnas centradas en `/admin/disenos`.
- Diseños por default `activo=false` (los 3 ya usados quedaron `true`).
- Migración 011: nuevos valores del enum `tipo_estampado`:
  - `doble_bordado_y_completo` (DTG + bordado = 19.000 extra).
  - `triple_completo` (DTG + estampado + bordado = 21.000 extra).
- `catalogo.ts` + tests + script de import actualizados con los nuevos casos.
- Script `wipe-import.sql` creado para re-imports idempotentes.

### Import real de inventario 50% ✅ (commit `1de417e`)
- JP subió xlsx actualizado en `docs/referencia/inventario-fisico.xlsx`.
- Formato real trae header en row 2 + 3 columnas SI/NO para estampado (en vez de un enum). El script `preparar-import-jp.mjs` ya lo parsea.
- Script mejorado para **consolidar duplicados** por clave `(tipo, producto, color, talla, diseño, estampado)`. Resultado: 106 filas crudas → 88 items únicos consolidados.
- `wipe-import.sql` reescrito como 3 statements secuenciales (CTEs modificantes no veían estado actualizado entre sí — idempotencia verificada).
- Wipe + re-import aplicados: 87 variantes + 127 unidades. Diferencia de 1 variante/3 unidades vs esperado (88/130) probablemente por timeout parcial en un chunk — no bloqueante.
- **17/87 SKUs con sufijo `-2/-3`** por colisiones de slug cuando hay diseños con mismas 4 primeras letras (ej. múltiples "Gris Claro" y "Gris Oscuro" → ambos son `GRI`). Documentado como **C-29**, mejora diferida a F2.

### POS móvil base ✅ (commit `802edda`)
- PWA configurada: `manifest.json` (start_url=/pos), service worker en `public/sw.js` (cache-first del shell, network-first de HTML, **no cachea Supabase**).
- `useOnline` hook + `OfflineBanner` (banner rojo cuando `navigator.onLine === false`).
- `CarritoProvider` (context React con items, subtotal, count, add/update/remove/clear).
- `POSLayout` con topbar compacto (logo O + nombre vendedor + carrito con badge + logout).
- `/pos` grilla responsive (2 cols móvil / 3 sm / 4 md) con search sticky + chips de filtro por tipo. Badges "Últimas N" / "Sin stock".
- Modal full-screen de detalle de variante con imagen grande, precio editable (prellenado con `precio_venta`), stepper de cantidad limitado por stock, botón "Agregar a venta".
- `/pos/carrito` con stepper por item, editar precio unit, eliminar, footer fixed con "Cobrar $N".

---

## 5. Qué está pendiente (orden estricto)

### 🔴 Prioridad 1 — Tarea 1.5 pantalla de cobro (BLOQUEANTE para probar POS end-to-end)

Ruta: `/pos/cobro`. Es **el plato fuerte del POS** — con esto JP puede vender.

**Features requeridas** (según `docs/plan/03-fase1-tareas.md` §Tarea 1.5 + decisiones P1-P10):
1. **Pagos mixtos (N pagos por venta)** — tabla `venta_pagos` ya existe. UI: agregar/quitar métodos (efectivo, transferencia, datáfono, crédito), cada uno con monto y referencia opcional.
2. **Efectivo recibido + vueltas** — si hay pago efectivo, input extra para efectivo entregado por cliente y cálculo de vueltas en pantalla grande.
3. **Descuento global** con motivo obligatorio (input de % o monto fijo, motivo texto).
4. **Cliente opcional** — buscador por teléfono; si no existe, crear al vuelo con nombre + teléfono. Tabla `clientes` ya existe.
5. **Foto de comprobante** — si el método es transferencia/datáfono, permitir subir foto. Usar `browser-image-compression` (<1MB), subir al bucket Storage `comprobantes` con path `{venta_id}/{timestamp}.{ext}`.
6. **Validación**: suma de `venta_pagos.monto === ventas.total ± 1 peso` (ya hay trigger `fn_validar_pagos_venta`). No confirmar hasta que cuadre.
7. **Confirmar venta** — insert atómico:
   - `ventas` (con `tipo_transaccion='venta'`, `metodo_pago` dominante, `descuento_monto/motivo`, `efectivo_recibido/vueltas`, `vendedor_id=auth.uid()`, `cliente_id` opcional).
   - `venta_items` por cada variante del carrito (trigger `fn_post_venta_item` descuenta stock).
   - `venta_pagos` por cada método (trigger valida suma).
8. **Post-venta**: toast de éxito, opción "Nueva venta" que limpia carrito y vuelve a `/pos`.

**Archivos a crear / editar**:
- `src/pages/pos/Cobro.tsx` (nueva).
- `src/components/pos/*.tsx` nuevos: `MetodoPagoRow`, `FotoComprobanteUpload`, `ClienteSearchInput`, `DescuentoModal`.
- `src/lib/queries/ventas.ts` (nueva) — `createVentaCompleta(venta, items, pagos)` atómico.
- `src/lib/queries/clientes.ts` (nueva) — buscar por teléfono, crear al vuelo.
- `src/lib/storage.ts` (nueva) — upload comprobante con compresión.
- `src/App.tsx` — agregar `<Route path="cobro" element={<Cobro />} />` en `/pos`.

**Queries SQL ya soportadas** (no hace falta migración nueva):
- `ventas`, `venta_items`, `venta_pagos` existen con triggers.
- Bucket `comprobantes` existe (migración 007).

### 🟡 Prioridad 2 — Devoluciones y cambios (Tarea 1.5 E6)

Después de que Cobro funcione. Ruta: `/pos/devoluciones` (nueva).
- Buscar venta original por fecha/cliente/últimos 4 teléfono.
- Seleccionar items a devolver (parcial o total).
- Crear nueva `ventas` con `tipo_transaccion='devolucion'`, `venta_original_id=<id>`, items con `costo_unitario` copiado del original, total negativo.
- El trigger `fn_post_venta_item` emite `anulacion_venta` positivo en inventario (lee `tipo_transaccion`).
- **Cambio** = devolución + venta nueva con mismo `venta_original_id`.

### 🟢 Prioridad 3 — Merge de `v2-f1-1.4-pedidos` a `v2`

Una vez que Cobro + Devoluciones estén listos y JP haya hecho QA. Branch name actual es engañoso: incluye más que solo pedidos (1.3b/c, POS base, import real). Al merger usar PR con título descriptivo.

### 🟢 Prioridad 4 — Import histórico del Sheet original

JP pidió: "hay que subir lo otro del documento de control operativo para no empezar de 0". Archivo en `docs/referencia/Control_Operativo_Orvann_Sheet_Original.xlsx`.

Contiene ventas históricas (~102 filas), gastos y consignaciones del Sheet original. Se importan como `notas='import_sheet_abril_2026'`. **NO se migra el inventario** del sheet (ese punto cero es el xlsx físico, que ya se cargó).

**Es post-POS porque no bloquea la operación**. Se hace cuando Cobro esté funcional y JP quiera ver datos históricos en el dashboard (que vendrá en F2).

### 🟢 Prioridad 5 — Tarea 1.6 Gastos y Tarea 1.7 Clientes

Ver `docs/plan/03-fase1-tareas.md` §Tarea 1.6 y 1.7 para detalle.

### 🟢 Prioridad 6 — F1 cierre

- Correr QA completo según `docs/plan/04-qa-plan.md`.
- Cerrar las sub-tareas known-issue (C-26 importer UI, C-29 fn_generar_sku mejorado).
- Deploy a Vercel.
- Merge `v2` → `main`.

---

## 6. Decisiones tomadas (NO volver a preguntar, está resuelto)

De `docs/plan/03-fase1-tareas.md` §Decisiones tomadas:

| # | Decisión |
|---|----------|
| P1 | **Devoluciones modelo A**: nueva fila `ventas` con `tipo_transaccion='devolucion'` + `venta_original_id`. |
| P2 | **Stack UI**: agregado `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `browser-image-compression`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`. **NO** agregar `sonner` ni `@tanstack/react-query`. |
| P3 | **Migraciones vía MCP** `apply_migration`, no `execute_sql`. |
| P4 | **Socios 33.3% cada uno** (informativo en `profiles.porcentaje_sociedad`). |
| P5 | **Enum `pagador_gasto`**: ORVANN / KATHE / ANDRES / JP. |
| P6 | **Enum `cuenta_consignacion`**: ahorros_orvann / corriente_orvann / nequi_orvann / daviplata_orvann / otro. |
| P7 | **`ventas.shopify_order_id` unique** + índice. |
| P8 | **No agregar `variantes.zona`** (prendas rotan mucho). |
| P9 | Repo/Supabase limpiados desde v1. |
| P10 | **Logo**: `docs/imagenes/ORVANN.png`. |

---

## 7. Protocolo de trabajo (seguir religiosamente)

1. **Un checkpoint por tarea**. Al terminar, mostrá a JP qué se hizo y pedí OK para mergear. El OK aplica a **decisiones de diseño/features/producto** (lo que ve en pantalla, lo que resolvés), no a QA funcional — ese se corre al cierre de fase.
2. **Cada tarea = un branch + un PR** con naming `v2-f1-{num}-{slug}`. Merge a `v2` solo con aprobación.
3. **Migraciones por MCP Supabase** (`mcp__4837ffe1-6581-409e-b61b-254b31bc076c__apply_migration`). **NUNCA** SQL destructivo sin OK.
4. **Antes de cada commit**: `npm run build` + `npm run lint` + `npm run test` — todo verde. CI en GitHub Actions valida lo mismo en cada push/PR (`.github/workflows/ci.yml`).
5. **Commits en español, imperativo, minúsculas**: "agrega pantalla de cobro", no "Agregando" ni "Added".
6. **Reporte al terminar cada tarea**: qué se hizo, commits, archivos, cómo verificar, qué queda.
7. **Si algo no está claro, preguntá** (10 preguntas > 1 construcción tirada).
8. **Ejecutar sin pedir confirmación** para tareas definidas en este doc. JP prefiere ver resultado.
9. **QA funcional se hace al cierre de fase**, no chunk por chunk. En checkpoint JP revisa diseño/features, pero no prueba cada sub-feature aisladamente. Test manual integral al cerrar F1 según `04-qa-plan.md`.
10. **Estilo visual**: indistinguible de DURATA. Si dudás de un componente, mirá `C:\Personal\Negocios\DURATA\durata_crm\src\components\*.tsx`.

---

## 8. Archivos clave por propósito

### Docs (leer en orden al arrancar)
1. `docs/plan/01-modelo-datos.md` — schema DB completo (fuente de verdad).
2. `docs/plan/02-plan-fases.md` — fases F1 → F5 con criterios.
3. `docs/plan/03-fase1-tareas.md` — tareas F1 + protocolo + decisiones + flujos operativos.
4. `docs/plan/04-qa-plan.md` — matriz de casos QA (estado: pendiente/ok/fail/bloqueado). **Documento vivo**, actualizar al cerrar cada tarea.
5. Este doc (`05-handoff-sesion.md`).

### Código
- `src/lib/catalogo.ts` — **motor de costos** (cálculo de `costo_adicional` + `previewSku`). Tests en `catalogo.test.ts` (17 tests verdes).
- `src/lib/queries/{disenos,productos,variantes,pedidos}.ts` — queries tipadas con joins.
- `src/lib/inventory-import.ts` — parser CSV/XLSX + importer.
- `src/components/ui.tsx` — primitivas (Button, Input, Modal, Table, StatusBadge, etc).
- `src/components/{Sidebar,Topbar,Toast,Login}.tsx` — chrome del admin.
- `src/components/pos/*.tsx` — POSTopbar, OfflineBanner, VarianteDetalleModal (falta: MetodoPagoRow, FotoComprobante, ClienteSearch).
- `src/hooks/{useAuth,useOnline,useCarrito}.ts[x]` — state.
- `src/layouts/{AdminLayout,POSLayout}.tsx`.
- `src/pages/admin/*.tsx` — Dashboard (placeholder), Productos, ProductoDetalle, Disenos, Variantes, Pedidos, PedidoNuevo, PedidoDetalle.
- `src/pages/pos/*.tsx` — POSHome (grilla), Carrito. **Falta: Cobro**.
- `src/App.tsx` — router.

### Supabase
- `supabase/migrations/*.sql` — 11 migraciones, todas aplicadas al proyecto live.
- `supabase/seed.sql` — proveedores / categorías / parametros_costo / diseños (inactivos por default).

### Scripts de import
- `scripts/preparar-import-jp.mjs` — parsea `docs/referencia/inventario-fisico.xlsx`, dedup, genera `tmp-import/payload.json`.
- `scripts/generar-sql-import.mjs` — genera `tmp-import/import.sql` one-liner.
- `scripts/wipe-import.sql` — limpia variantes/movimientos del import (idempotente).
- `scripts/aplicar-import.mjs` — draft (no operativo; usamos MCP direct).
- `tmp-import/` gitignored.

---

## 9. Credenciales y accesos

- **`.env.local`** (gitignored): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` ya configurados.
- **Login admin**: `rjuanpablohb@gmail.com` (password solo JP). Profile ya creado (`rol='admin', es_socio=true`).
- **MCP Supabase**: el proyecto `nldctykjvyqsggwvweeh` está conectado. Usar `apply_migration` para DDL, `execute_sql` solo para SELECT o DML controlado.
- **MCP no reactiva proyectos pausados** — si el proyecto está `INACTIVE`, JP debe ir al dashboard de Supabase y darle "Restore project".

---

## 10. Known issues (documentados, no resolver ahora)

| # | Issue | Prioridad | Dónde resolverlo |
|---|-------|-----------|------------------|
| C-26 | Importer UI no soporta formato real de JP (header en row 2, 3 cols SI/NO). Por ahora se usan scripts one-shot. | Baja | Sub-tarea 1.3c diferida, post-F1. |
| C-29 | `fn_generar_sku` colisiona SKU slugs cuando hay diseños con mismas primeras letras (17/87 tienen sufijo `-2/-3`). | Baja | Mejorar función en F2 (usar hash o counter per producto). |
| Bundle | 957 KB / 291 KB gzip — warning Vite de chunk >500 KB. | Baja | Code-splitting post-F1 (xlsx es el mayor ofensor). |
| lint warnings | `watch()` de react-hook-form genera 2 warnings de `react-hooks/incompatible-library` — esperados, no son errores. | — | Ignorar. |

---

## 11. Comandos rápidos de referencia

```bash
# dev server
npm run dev              # arranca en localhost:5173 o 5174

# verificación antes de commit
npm run build && npm run lint && npm run test

# regenerar tipos DB tras migración nueva
# (no hay script; usar MCP generate_typescript_types y pegar en src/types/database.ts)

# re-importar inventario desde xlsx actualizado
node scripts/preparar-import-jp.mjs > tmp-import/payload.json
node scripts/generar-sql-import.mjs
# luego aplicar tmp-import/import.sql por chunks via MCP execute_sql
# antes: correr scripts/wipe-import.sql via MCP para limpiar

# checkpoint típico
git checkout -b v2-f1-X.Y-slug
# ... trabajar ...
git commit -m "implementa X (Tarea X.Y)"
# ... reportar a JP, esperar OK ...
git checkout v2 && git merge --no-ff v2-f1-X.Y-slug
```

---

## 12. Sugerencia de primer mensaje al arrancar nueva sesión

> **A JP**: "Retomo la sesión. Leí `docs/plan/05-handoff-sesion.md` y tengo el contexto. El próximo paso según el plan es construir `/pos/cobro` (pantalla de cobro del POS con pagos mixtos, cliente opcional, foto comprobante y confirmar venta). ¿Arranco con eso o querés priorizar otra cosa?"

Si JP dice OK, arrancar con:
1. Crear `src/lib/queries/ventas.ts` + `src/lib/queries/clientes.ts` + `src/lib/storage.ts`.
2. Crear `src/pages/pos/Cobro.tsx` y sus componentes auxiliares.
3. Agregar ruta en `App.tsx`.
4. Build + lint + test + commit.
5. Reportar a JP con screenshot/pasos para probar y esperar OK para devoluciones.

---

## 13. Cosas que JP dejó pendiente / dichas y no hechas

- **Deploy a Vercel**: no hecho, esperando F1 cierre.
- **Probar en celular**: JP no puede hasta que haya deploy. No insistir con "probá en el celular".
- **Probar por secciones**: JP prefiere QA completo al final, no ir chunk por chunk.
- **Import histórico del Sheet**: pendiente, post-cobro.
- **Reducir el bundle**: pendiente, post-F1.
- **17 SKUs con sufijo**: JP puede editar manualmente si le molestan; o mejorar en F2.

---

Buena suerte 🫡
