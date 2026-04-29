# Handoff de sesión — ORVANN Gestión

**Última actualización**: 2026-04-29 (post Bloque B1 + RLS anon temporal)
**Para**: la próxima sesión de Claude Code que retome el trabajo.

> Este documento es el punto de entrada. Léelo antes de hacer cualquier cosa. Después consultá los docs 01-04 y especialmente `06-cierre-f1-y-deploy.md` (plan operativo vivo).

---

## 1. Contexto del proyecto en 5 líneas

- **ORVANN Gestión**: sistema web + PWA móvil que reemplaza un Google Sheet para una tienda de streetwear en Medellín (3 socios: Kathe, Andrés, JP).
- **Stack**: React 19 + TS estricto + Tailwind v4 + Vite · Supabase (DB/Auth/Storage/Realtime) · Vercel (deployado).
- **Tres superficies**: Admin web (PC), POS móvil (PWA), Bot Telegram F3 (próximo).
- **Proyecto Supabase**: `nldctykjvyqsggwvweeh` (organización `ccakrhvhypuqpphulxoz`).
- **Estilo visual** indistinguible de DURATA (`C:\Personal\Negocios\DURATA\durata_crm`) — paleta oklch cool-steel, tema claro.

---

## 2. Estado actual del código

**Branch en GitHub**:
- `main` → branch live deployable a Vercel (recién creada, contiene todo F1).
- `v2-f1-1.5.1-cobro` → branch de trabajo activa (espejo de `main`).
- `dev` → obsoleta (v1 descartado, NO tocar).

**Vercel**:
- Proyecto: `prj_hYu2AAvarngZvvDgbvSjaRnxLeYf` en team `Juan Pablo's projects`.
- Dominio: `https://orvann-gestion.vercel.app/`.
- ⚠️ **JP debe configurar Production Branch a `main`** y agregar env vars en Vercel para que el deploy real apunte al código nuevo. Hoy production sigue en `dev` (v1 viejo).

**Commits desde el handoff anterior** (más nuevo arriba):
```
2fa600c  B1 importer mejorado: header auto-detect + SI/NO + dedup + sin-costo
f631ec1  bloque A pre-deploy: validacion credito + sort/filtros + sku v2 + indexes + reset
40315e7  fix flujo cliente + ventas a credito con abonos
7d8a1ec  implementa Clientes admin + /admin/ventas historial (Tarea 1.7)
faa73df  implementa /pos/devoluciones (Tarea 1.5.2)
7c9ff97  parametros de costo editables desde /admin/config
7469aa4  crear variante al vuelo desde mapeo de item de pedido
d1e7de5  buscadores multi-columna + sort por header en Variantes
30d3d8c  MoneyInput reusable + notificacion realtime de ventas al admin
6aa757c  redisena flujo de Transformaciones (feedback JP)
f67096d  fixes UI POS + edicion de gastos + CRUD proveedores
8b3f573  implementa modulo Transformaciones (Tarea 1.5.3)
b529444  integra Pedido pagado -> Gasto automatico (Tarea 1.6b)
305552a  implementa modulo Gastos admin (Tarea 1.6)
2f28874  ajustes POS: foto con cámara+galería, link POS desde admin, dev --host
b7ab9cd  implementa pantalla /pos/cobro con pagos mixtos (Tarea 1.5.1)
318fa37  housekeeping: CI + reconciliacion stock + code-splitting + rename xlsx
```

---

## 3. Estado de Supabase (vivo)

| Entidad | Valor |
|---------|-------|
| Productos | 0 (post-reset) |
| Variantes | 0 |
| Movimientos inventario | 0 |
| Stock total | 0 |
| Diseños | 43 (6 activos, seed) |
| Profiles | 1 (JP, admin) |
| Ventas / items / pagos / abonos | 0 |
| Pedidos proveedor / gastos | 0 |
| Categorías de gasto | 17 (seed) |
| Parámetros de costo | 6 (seed) |
| Proveedores | 3 (seed) |

**BD reseteada** el 2026-04-29 al cierre del Bloque A. JP debe re-importar inventario (ver §4 Bloque B2).

**Migraciones aplicadas (17)**:
- 000-011: schema base (reset, enums, tablas, funciones, triggers, indexes, RLS, storage, function search path, grants, profile auto, estampado edge cases)
- 012: reconciliación stock (`fn_reconciliar_stock`, `fn_corregir_stock_cache`)
- 013: pedido pagado → gasto auto (`gastos.ref_pedido_id`, `fn_crear_gasto_de_pedido`)
- 014: realtime publication para `ventas`
- 015: `fn_generar_sku` v2 (resuelve C-29 — sufijos `-2/-3`)
- 016: indexes en 22 FKs (resuelve advisor de performance)
- 017: **RLS abierta a anon (TEMPORAL)** — para sacar el login mientras JP testea

**Advisor security**: 24 warnings de RLS abiertas + 2 SECURITY DEFINER + 1 leaked password protection. Todos esperados/diferidos.
**Advisor performance**: 0 unindexed FKs. 27 unused indexes (esperados — BD vacía).

---

## 4. Sistema funcionalmente completo

### Admin (`/admin`)
- **Catálogo**: Productos, Variantes (multi-sort + filtro "Sin costo"), Diseños.
- **Operación**: Pedidos (crear/pagar/recibir → crea gasto auto), Transformaciones (rediseñadas con checkboxes + auto-create destino), Ventas (listado con filtros + KPIs incluido crédito pendiente), VentaDetalle con items/pagos/abonos.
- **Financiero**: Gastos (crear/editar/borrar con distribución), Consignaciones (placeholder F2).
- **Relaciones**: Clientes (listado + detalle con historial), Proveedores (CRUD).
- **Sistema**: Configuración de parámetros de costo editables.
- **Realtime**: notificación al admin con beep + toast + browser notification al completarse venta en POS.

### POS móvil (`/pos`)
- Grilla de variantes activas, búsqueda, filtros por tipo.
- Modal detalle de variante con MoneyInput.
- Carrito con stepper, edición de precio.
- **Cobro**: pagos mixtos N métodos, descuento global con motivo, cliente con auto-form de creación, foto comprobante (cámara/galería), efectivo+vueltas, validación suma, **cliente obligatorio en crédito**.
- **Devoluciones**: buscar venta, marcar items con respeto a unidades ya devueltas, confirmar (reintegra stock).
- Layout centrado max-w-md en PC, fixed footer max-w.

### Importer (`/admin/variantes` → "Importar CSV")
- Auto-detect del header row.
- Conversión automática de columnas SI/NO a campo `estampado`.
- Consolidación de duplicados con suma de cantidades.
- Acepta `costo_unit = 0` (variantes sin costo se identifican con badge rojo + filtro).

---

## 5. Plan operativo vivo

**Fuente de verdad**: `docs/plan/06-cierre-f1-y-deploy.md`.

| Bloque | Estado | Comentario |
|--------|--------|------------|
| **A** Pre-deploy (validaciones + sort + SKU + indexes + reset) | ✅ | Commit `f631ec1` |
| **B1** Importer mejorado (auto-detect + SI/NO + dedup) | ✅ | Commit `2fa600c` |
| **B2** Carga del inventario real | ⏳ | JP arrastra `inventario-fisico.xlsx` al admin |
| **B3** Deploy a Vercel | ⚠️ Vercel apunta a branch `dev` viejo | JP debe cambiar Production Branch a `main` + agregar env vars |
| **B4** Cerrar RLS antes de invitar vendedores | ⏳ | Migración nueva: policies según `profiles.rol`. **NO HACERLO** mientras JP testea sin login |
| **B5** Actualizar QA 04 | ✅ | Casos nuevos: V-13 crédito, AB-01 abonos, D-01 devoluciones, T-01 transformaciones, IM-01 importer, CF-01 config, etc. |
| **B6** QA integral | ⏳ | Cuando JP esté listo |
| **C** Bot Telegram F3 | ⏳ | Sesión separada — ver §7 |
| **D** Diferidos (F2, F4, refactors) | — | TBD |

---

## 6. Decisiones tomadas (no volver a preguntar)

| # | Decisión |
|---|----------|
| P1 | **Devoluciones modelo A**: nueva fila `ventas` con `tipo_transaccion='devolucion'` + `venta_original_id`. |
| P2 | **Stack UI**: agregado `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `browser-image-compression`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`. NO `sonner` ni `@tanstack/react-query`. |
| P3 | **Migraciones vía MCP** `apply_migration`. |
| P4 | **Socios 33.3% cada uno**. |
| P5 | **Enum `pagador_gasto`**: ORVANN / KATHE / ANDRES / JP. |
| P6 | **Enum `cuenta_consignacion`**: ahorros_orvann / corriente_orvann / nequi_orvann / daviplata_orvann / otro. |
| P7 | **`ventas.shopify_order_id` unique**. |
| P8 | **No agregar `variantes.zona`**. |
| P9 | Repo/Supabase limpiados. |
| P10 | **Logo**: `docs/imagenes/ORVANN.png`. |
| P11 | **Reset BD** para arrancar producción con data fresca (post-Bloque A). |
| P12 | **Sin login** (modo anon temporal — RLS abierta a anon). Se cierra antes de invitar vendedores. |
| P13 | **Sin leaked password protection** por ahora. |
| P14 | **Auto-cálculo de costos** = `costo_base + adicional` (ya implementado). Filtro "Sin costo" identifica las que faltan. |
| P15 | **Bot Telegram** se hace post-operación real con data viva (Bloque C). |

---

## 7. Bloque C — Bot Telegram (próxima sesión grande)

**Setup mínimo viable**:
1. Crear bot con BotFather, copiar token.
2. Endpoint Vercel `/api/telegram-orvann` (serverless function) que reciba el webhook.
3. Validar firma de Telegram + `profiles.telegram_chat_id`.
4. Clasificador con Gemini 2.5 Flash con intenciones:
   - Consultas: ventas hoy, stock variante, gastos mes, cliente, KPI.
   - Registro: venta rápida ("vendí 2 boxy negras a 70k efectivo"), gasto, consignación.
5. Confirmación con resumen + "OK" antes de persistir.
6. Alertas proactivas (stock bajo, descuadres, cierre pendiente) con cron job.

**Variables de entorno necesarias en Vercel**:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (para validar firma)
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para escritura desde serverless)

**Archivos a crear**:
- `api/telegram-orvann.ts` (Vercel serverless con runtime node).
- `src/lib/telegram/classifier.ts` (llamada a Gemini).
- `src/lib/telegram/intents/*.ts` (handlers por intent).
- `src/lib/telegram/auth.ts` (verificar chat_id).
- Migración para agregar campos faltantes a `bot_logs` si hace falta.

**Decisiones a confirmar antes de arrancar C**:
- ¿Polling o webhook? → webhook (Vercel serverless).
- ¿Idioma de respuesta? → español Colombia, formato `$1.250.000`.
- ¿Quiénes están autorizados? → JP, Kathe, Andrés (campo `telegram_chat_id` en profiles).

---

## 8. Archivos clave

### Docs (leer en orden al arrancar)
1. `docs/plan/01-modelo-datos.md` — schema DB completo.
2. `docs/plan/02-plan-fases.md` — F1 → F5 con criterios.
3. `docs/plan/03-fase1-tareas.md` — tareas F1 + flujos operativos.
4. `docs/plan/04-qa-plan.md` — matriz de QA actualizada.
5. `docs/plan/05-handoff-sesion.md` — este doc.
6. **`docs/plan/06-cierre-f1-y-deploy.md`** — plan operativo vivo (bloques A-D).

### Código clave
- `src/lib/queries/{ventas,clientes,gastos,proveedores,parametros,disenos,productos,variantes,pedidos,transformaciones,devoluciones}.ts`.
- `src/lib/catalogo.ts` — motor de costos con tests.
- `src/lib/storage.ts` — upload comprobante con compresión.
- `src/lib/inventory-import.ts` — parser xlsx con auto-detect + dedup.
- `src/lib/sort.ts` — helper de sort genérico.
- `src/components/ui.tsx` — primitivas + `SortableTH`.
- `src/components/MoneyInput.tsx` — input monetario reusable.
- `src/components/admin/{GastoForm,ProveedorFormModal,AbonoModal}.tsx`.
- `src/components/pos/*.tsx` — `Cobro`, `Devoluciones`, etc.
- `src/components/AdminRealtimeNotifier.tsx` — notif beep + browser notification.
- `src/App.tsx` — router + auto signInAnonymously.

### Supabase
- `supabase/migrations/*.sql` — 17 migraciones aplicadas.
- `supabase/seed.sql` — proveedores / categorías / parametros_costo / diseños.

---

## 9. Credenciales y accesos

- **`.env.local`** (gitignored): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- **Login admin**: `rjuanpablohb@gmail.com` (password solo JP). Profile creado.
- **Modo sin login**: `signInAnonymously` se intenta automáticamente. Si Supabase tiene "Anonymous sign-ins" off, igual funciona porque RLS está abierta a anon.
- **MCP Supabase** conectado al proyecto `nldctykjvyqsggwvweeh`.
- **Vercel**: proyecto `prj_hYu2AAvarngZvvDgbvSjaRnxLeYf`, team `team_R6ft2OSBcs4UcQYSex0UrxPW`.
- **GitHub**: `https://github.com/jupramirezes/orvann-gestion` con branches `main`, `v2-f1-1.5.1-cobro`, `dev`.

---

## 10. Known issues / deuda técnica

| # | Issue | Severidad | Plan |
|---|-------|-----------|------|
| RLS abierta a anon | 🔴 Alta antes de invitar usuarios | Bloque B4: cerrar antes de Kathe/Andrés |
| 27 unused indexes en advisor performance | 🟢 Baja | Esperados (BD vacía); revisar tras 1 mes con data |
| C-26 importer UI genérico | 🟢 Baja | Resuelto parcialmente con B1; el genérico DataImporter no se construyó (overkill) |
| C-29 SKUs con sufijo | ✅ Resuelto en migración 015 |
| 2 lint warnings (`watch()` de react-hook-form) | — | Ignorar |
| Tests de integración | 🟡 Media | Diferido a F2 |

---

## 11. Comandos rápidos

```bash
# Dev local
npm run dev              # localhost + LAN (--host activado)

# Verificación pre-commit
npm run build && npm run lint && npm run test

# Regenerar tipos DB tras migración
# (usar MCP generate_typescript_types y pegar en src/types/database.ts)

# Reconciliar stock manualmente
select * from fn_reconciliar_stock();
select fn_corregir_stock_cache();

# Re-importar inventario por script (legacy, ya no necesario con B1)
node scripts/preparar-import-jp.mjs > tmp-import/payload.json
```

---

## 12. Sugerencia de primer mensaje al arrancar nueva sesión

> "Retomo. Leí `05-handoff-sesion.md` y `06-cierre-f1-y-deploy.md`. Bloques A y B1+B5 cerrados. Próximos: B2 (carga inventario real cuando JP lo arrastre al admin), B3 (deploy Vercel — JP cambia Production Branch a `main` y agrega env vars), B4 (cerrar RLS antes de vendedores) o C (bot Telegram). ¿Por cuál arranco?"

---

Buena suerte 🫡
