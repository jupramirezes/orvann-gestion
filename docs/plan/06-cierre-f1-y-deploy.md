# ORVANN Gestión — Cierre F1 y Deploy

**Última actualización**: 2026-04-29
**Branch activa**: `v2-f1-1.5.1-cobro` (será mergeada a `v2` y luego a `main` al cerrar QA)

> Plan operacional para cerrar Fase 1 y poner el sistema en manos de los vendedores. Tres bloques: pre-deploy (mejoras + reset), deploy real, post-deploy (Telegram, ajustes finales).
>
> Decisión confirmada por JP el 2026-04-29:
> - **Reset completo de BD**: la data actual es real pero se va a actualizar; mejor empezar limpio.
> - **Auto-cálculo de costos**: el sistema calcula costo total = costo prenda + transformaciones + bolsa + etiquetas + marquilla.
> - **Sin password protection** ahora (Auth queda como está).
> - **RLS abierto se mantiene** mientras solo JP usa el sistema. Se cierra antes de invitar a Kathe/Andrés (sub-bloque del Bloque B).

---

## Bloque A — Pre-deploy (esta sesión y/o siguiente)

Objetivo: dejar el código listo para producción y la BD vacía.

### A1. Validación cliente obligatorio en crédito ✅ (10 min)

- En `/pos/cobro`, si hay algún pago con método "A crédito" y no hay cliente seleccionado, deshabilitar el botón "Confirmar venta" con tooltip explicativo.
- Razón: las deudas sin cliente identificado son imposibles de cobrar.

**Criterio de aceptación**: intentar cobrar a crédito sin cliente muestra mensaje "Asociá un cliente antes de cobrar a crédito" y bloquea el botón.

### A2. Sort + filtros consistentes en Productos / Pedidos / Gastos (30 min)

- Extraer `SortableTH` de `Variantes.tsx` a componente compartido en `src/components/ui.tsx`.
- Aplicar a las 3 tablas con sort por columnas relevantes.
- Productos: nombre, tipo, proveedor, fecha creación, count variantes.
- Pedidos: fecha, proveedor, estado pago, total, recepción.
- Gastos: fecha, categoría, pagador, distribución, monto.

**Criterio de aceptación**: header clickeable en las 3 tablas con asc/desc visual.

### A3. Auto-cálculo de costos en Variantes (45 min)

Lo que JP pidió: "El costo lo debe calcular el sistema con valor de prenda y valor de transformación, bolsa, etiq, etc."

**Lo que ya hace el sistema**:
- `costo_total = costo_base + costo_adicional` (columna generada).
- `costo_adicional` se calcula automáticamente al crear variante con `calcularCostoAdicional(parametros, tipo, estampado)`.

**Lo que falta** (gap operacional):
- En el inventario actual hay variantes con `costo_base = 0` (se importaron sin que JP supiera el costo del proveedor).
- No hay forma fácil de identificar y completar esos costos.

**Implementación**:
- Filtro nuevo en `/admin/variantes`: **"Sin costo definido"** (`costo_base = 0`).
- En la lista de variantes, badge rojo "Sin costo" en filas con `costo_base = 0`.
- El form de crear/editar variante muestra el desglose en vivo: costo_base + breakdown adicional + total.
- Al editar, si `costo_base > 0` el badge desaparece.

**Criterio de aceptación**: filtrar "Sin costo" muestra solo las que faltan; al cargar el inventario JP puede ir completando uno por uno.

### A4. Migración 015 — fn_generar_sku mejorado (C-29) (15 min)

Reemplazar la lógica que produce sufijos `-2/-3` por una que **expande las letras del diseño** progresivamente cuando hay colisión:
- Probar con 4 letras del diseño → si colisiona, 5, 6, 7, 8.
- Solo si después de 8 letras todavía colisiona, usar sufijo numérico.

**Ejemplo**: dos diseños "Gris Claro" y "Gris Oscuro" producen colisión con `GRI`. Con la nueva lógica:
- `GRIS` → todavía colisiona ("Gris" como 4 letras es igual).
- `GRISC` (Gris Claro) vs `GRISO` (Gris Oscuro) → no colisionan ✓

**Criterio de aceptación**: `select fn_generar_sku(...)` con dos diseños similares devuelve SKUs distintos sin sufijo numérico.

### A5. Migración 016 — Indexes en FKs (10 min)

Agregar índices a los 22 FKs reportados por advisor de performance. Mejora futuras queries con joins.

**Criterio de aceptación**: `get_advisors type=performance` devuelve 0 unindexed_foreign_keys.

### A6. Reset de BD (5 min)

Borrar todo el catálogo + transaccional. Mantener:
- `profiles` (JP).
- `categorias_gasto` (seed 17).
- `parametros_costo` (seed 6).
- `proveedores` (seed 3 + los que JP haya creado).
- `disenos` (seed 43, JP activa los que use).

Borrar:
- `productos`, `variantes`, `movimientos_inventario`.
- `ventas`, `venta_items`, `venta_pagos`, `venta_abonos`.
- `pedidos_proveedor`, `pedidos_proveedor_items`.
- `gastos`, `transformaciones`, `clientes`, `consignaciones`, `cierres_caja`.
- `plan_separe*`, `entregas`, `audit_log`.

**Criterio de aceptación**: ningún drift, advisors limpios, JP puede empezar a importar inventario fresco.

### A7. (Opcional) Cerrar RLS por rol — migración 017

**Solo antes de invitar a Kathe/Andrés**. Hoy no es bloqueante porque solo JP usa el sistema.

- Vendedor: lee catálogo, crea ventas/clientes/devoluciones; **no** ve costos, gastos, parámetros, dashboard, otros vendedores.
- Admin: ve todo.

Diferido al Bloque B (post-deploy inicial).

---

## Bloque B — Deploy a Vercel + migración de data (próxima sesión)

### B1. Importer UI genérico (C-26) (2-3 horas)

Antes del deploy, dejar el importer UI funcionando para que JP pueda cargar datos sin scripts:
- Componente `<DataImporter>` genérico con preview + apply.
- Schemas zod para variantes, gastos, ventas históricas, clientes.
- RPC SQL para apply atómico.

**Criterio de aceptación**: JP arrastra el xlsx al admin, ve preview con diffs, confirma, datos cargados.

### B2. Cargar inventario real fresco (30-60 min)

Con BD reseteada y importer funcionando:
- JP usa el importer UI para cargar `inventario-fisico.xlsx` actualizado.
- Verificar que costos se calculan automáticamente (con A3).
- Verificar que SKUs no tienen sufijos -2/-3 (con A4).

**Criterio de aceptación**: JP carga 88+ variantes en una sola pasada sin errores.

### B3. Deploy a Vercel (30-60 min)

1. JP conecta repo a Vercel (cuenta nueva o existente).
2. Configurar variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Build & deploy automático.
4. Configurar dominio (subdominio Vercel o custom).
5. Actualizar `manifest.json` `start_url` con el dominio real.
6. PWA install desde celular.

**Criterio de aceptación**: vendedor abre URL en cel, instala PWA, hace una venta de prueba que se registra correctamente.

### B4. Cerrar RLS antes de invitar usuarios (1 hora)

- Migración 017 con policies role-based según `profiles.rol`.
- Crear usuarios para Kathe y Andrés con rol `vendedor`.
- Verificar: vendedor logueado NO ve `/admin/gastos`, `/admin/dashboard`, costos en `/admin/variantes`.

**Criterio de aceptación**: 6 casos QA de seguridad pasan (vendedor restringido, admin libre).

### B5. Actualizar QA 04 (30 min)

Con todo lo nuevo (devoluciones, abonos, transformaciones, parámetros editables, importer UI, cliente obligatorio, RLS cerrado), agregar filas a la matriz de QA.

### B6. QA integral (2-3 horas)

JP ejecuta la matriz `04-qa-plan.md` end-to-end.

---

## Bloque C — Bot Telegram F3 (sesión aparte, post-deploy)

Este bloque es grande y se hace después de que el sistema esté operando con vendedores reales. Razón: antes de automatizar consultas, necesitamos data real fluyendo.

### C1. Setup de webhook en Vercel (30 min)
- Endpoint `/api/telegram-orvann` (Vercel serverless function).
- Webhook configurado con BotFather.
- Validación de firma de Telegram.

### C2. Clasificador de intenciones con Gemini 2.5 Flash (2-3 horas)
- Integración con API de Gemini.
- Intenciones: consulta_ventas, consulta_stock, consulta_gastos, consulta_cliente, consulta_kpi, registro_venta, registro_gasto, registro_consignacion.

### C3. Autorización por chat_id (30 min)
- `profiles.telegram_chat_id` para JP/Kathe/Andrés.
- Chats desconocidos reciben "no autorizado" + log.

### C4. Confirmación para acciones (1 hora)
- Resumen + "OK" antes de persistir.

### C5. Alertas proactivas (1 hora)
- Cron job diario: stock bajo, cierre pendiente, descuadres.
- Notificación push real (la app cerrada en el cel también recibe).

**Criterio de aceptación**: "ventas hoy", "stock hoodie L", "vendí 2 boxy negras a 70k efectivo" funcionan correctamente.

---

## Bloque D — Diferidos (cuando haga falta)

| # | Tarea | Cuándo |
|---|-------|--------|
| D1 | Sub-tareas de F2 (cierre caja, plan separe, dashboard, etc.) | Después de operar 1-2 semanas en producción |
| D2 | Shopify sync (F4) | Cuando JP tenga catálogo estable y quiera vender online |
| D3 | Tests de integración con Vitest + Supabase test DB | F2 cuando crezca el código |
| D4 | Code-splitting fino del chunk de Variantes (xlsx) | Si el bundle se vuelve problema |

---

## Resumen ejecutivo

| Bloque | Esfuerzo | Cuándo | Blocker |
|--------|----------|--------|---------|
| **A** Pre-deploy (validación + sort + costos + SKU + indexes + reset) | 1 sesión (~3h) | **Esta sesión** | — |
| **B** Importer UI + carga real + deploy + RLS + QA | 2-3 sesiones | Siguiente | Bloque A |
| **C** Bot Telegram (F3) | 1-2 sesiones | Post-operación real | Bloque B + 1 semana de uso |
| **D** F2 / F4 / refactors | TBD | Cuando aplique | — |

**Camino crítico al deploy**: A1 → A2 → A3 → A4 → A5 → A6 → B1 → B2 → B3 → B4 → B5 → B6 → 🟢 **Vendedores usando el sistema**.

---

## Decisiones tomadas (no volver a preguntar)

| # | Decisión |
|---|----------|
| D1 | **Reset completo de BD** antes de cargar data real. |
| D2 | **Auto-cálculo de costos**: filtro "Sin costo" en variantes + edit. La fórmula = `costo_base + adicional` ya implementada. |
| D3 | **Leaked password protection**: NO activar por ahora. |
| D4 | **RLS abierto** mantenido hasta el deploy + invite vendedores (Bloque B4). |
| D5 | **Bot Telegram** se hace después del primer mes de operación real (Bloque C, no B). |
