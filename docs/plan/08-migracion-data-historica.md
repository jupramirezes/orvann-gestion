# ORVANN Gestión — Migración de data histórica

> Plan para llevar el contenido del Sheet (`docs/referencia/Control_Operativo_Orvann.xlsx`) al sistema. JP ya tiene el inventario actualizado en `inventario-fisico.xlsx`; las transformaciones hechas esta semana están en `transformaciones-semana.txt` (parseadas de WhatsApp).

**Objetivo final**: `entradas (pedidos) − salidas (ventas) = stock actual` con tolerancia 0. Si no cuadra, sabemos exactamente dónde está el desfase.

---

## Mapeo Sheet → Tablas Supabase

| Hoja Sheet | Filas | Tabla destino | Estado |
|------------|-------|---------------|--------|
| **Inventario** (101 filas) | 101 | `productos` + `variantes` | ✅ JP carga con importer mejorado (Bloque B2) |
| **Ventas** (113 filas) | 113 | `ventas` + `venta_items` (sin pagos) | 🟡 Próxima sesión — script one-shot |
| **Pedidos Proveedores** (20 filas) | 20 | `pedidos_proveedor` + `_items` | 🟡 Próxima sesión — script o UI |
| **Gastos** (164 filas) | 164 | `gastos` (con distribución equitativa expandida) | 🔴 **Esta sesión** — importer UI |
| **Costos Fijos** (6 filas) | 6 | (referencia; usar como gastos recurrentes) | 🟢 Diferido |
| **Cotizador** (190 filas) | 190 | Update `variantes.costo_base` por SKU | 🟡 Próxima sesión |
| **Análisis Precios** | 33 | (informativo; se reemplaza con Dashboard F2) | 🟢 Diferido |
| **P.Eq Proyección** | 56 | (informativo; Dashboard F2) | 🟢 Diferido |
| **Caja Diaria** + **Cierre de caja** | 57 + 16 | `cierres_caja` | 🟢 Diferido (F2) |
| **Resumen** | 112 | (informativo) | 🟢 Diferido |

---

## Detalle por hoja crítica

### 1. Gastos (164 filas) — 🔴 prioridad alta

**Estructura del Sheet**:
```
Fecha | Categoría | Monto | Descripción | Método Pago | Responsable | Notas
```

**Particularidad importante**: cada gasto equitativo aparece **3 veces** en el Sheet (una por socio: KATHE, ANDRES, JP) con el mismo monto. Ejemplo:
```
1/12/2025 | Arriendo | 404,000 | Pago arriendo Diciembre | Transferencia | KATHE
1/12/2025 | Arriendo | 404,000 | Pago arriendo Diciembre | Transferencia | ANDRES
1/12/2025 | Arriendo | 404,000 | Pago arriendo Diciembre | Transferencia | JP
```

Total $1.212.000 distribuido equitativamente $404k cada uno.

**Lógica del importer**:
1. Agrupar por (fecha, categoría, descripción, método_pago) y detectar si las 3 filas existen para los 3 socios.
2. Si las 3 filas: tratar como 1 gasto distribución `equitativa` con `monto_total = 3 × monto_individual`.
3. Si solo 1 fila con responsable específico: tratar como `asignada` con ese pagador.
4. Si responsable=ORVANN: tratar como `orvann`.
5. Mapear categoría del Sheet a `categorias_gasto.id` (find por nombre).

**Mapeo de categorías Sheet → BD**:
- "Arriendo" → "Arriendo"
- "Servicios (Agua, Luz, Gas)" → "Servicios (Agua/Luz/Gas)"
- "Internet", "Nómina", etc. → match directo

**Implementación**: importer UI en `/admin/gastos` con botón "Importar" similar al de variantes. Acepta xlsx, hace preview, confirma.

### 2. Pedidos Proveedores (20 filas) — 🟡 próxima sesión

**Estructura**:
```
Fecha Pedido | Proveedor | Descripción | Unidades | Costo Unit | Total | Estado Pago | Fecha Pago | Notas
```

**Particularidad**: cada fila es UN ITEM de un pedido. Pero dos filas con misma fecha+proveedor son del mismo pedido.

**Lógica**:
1. Agrupar por (fecha_pedido, proveedor) → 1 pedido cabecera.
2. Cada fila del grupo es un item (`pedidos_proveedor_items` con `descripcion_libre` por ahora).
3. Mapeo a variantes: post-import JP usa el botón "Mapear" de cada item.
4. **NO marcar como recibido** (el inventario ya está cargado por separado en B2).
5. Si `Estado Pago = Pagado`, marcar `estado_pago='pagado'` con `fecha_pago` → trigger crea gasto auto en categoría Mercancía. Pero esto duplicaría con la hoja Gastos. **Decisión: importar pedidos como `estado_pago='pagado'` SIN disparar el trigger** (cargar fecha_pago directo y desactivar trigger temporalmente, o usar un flag de migración).

**Implementación**: script one-shot `scripts/import-pedidos-historico.mjs` con safeguards.

### 3. Ventas (113 filas) — 🟡 próxima sesión

**Estructura**:
```
Fecha | SKU | Producto | Costo | Precio Venta | Método Pago | Cliente | Notas
```

**Particularidad**: cada fila es UN ITEM de venta. Múltiples ítems del mismo cliente/fecha pueden ser una sola venta o varias separadas — **ambiguedad operacional**.

**Lógica conservadora**:
1. Tratar cada fila como una venta independiente (1 venta = 1 item).
2. Crear cliente si no existe.
3. Insert `ventas` con `tipo_transaccion='venta'`, `estado='completada'`, `notas='import_historico'`.
4. Insert `venta_items` con la variante (matching por SKU exacto del Sheet).
5. Insert `venta_pagos` con el método indicado y monto = precio_venta.
6. **Saltar** las que tengan SKU que no exista en la BD (logear).

**Cuidado**: el trigger `fn_post_venta_item` va a emitir movimientos de inventario. Como el inventario ya se cargó en B2 con stock actual (no histórico), **al importar las ventas el stock se va a descontar otra vez**. **Decisión**: antes de importar ventas, JP debe **agregar al stock las unidades que se vendieron históricamente** o aceptar que el sistema empieza desde el stock físico actual (ya descontados los vendidos).

**Recomendación**: importar ventas como `tipo_transaccion='venta'` con `referencia_tipo='import_historico'` en sus movimientos, y **antes de importar** sumar al inventario las cantidades correspondientes para que la operación deje el stock final correcto. Esto requiere un cálculo previo: `stock_objetivo = stock_actual_físico + ventas_a_importar`.

**Implementación**: script one-shot con preview de impacto en stock antes de aplicar.

### 4. Cotizador → Update costos de variantes existentes — 🟡 próxima sesión

**Estructura** (header en row 3):
```
Tipo Producto | Proveedor | Costo Base | Estampado Punto Corazón | Bordado Punto Corazón | Estampado Completo | Etiquetas | Empaque | Costo Unitario | Precio Venta Unitario | Ganancia | Margen
```

**Lógica**:
- El Cotizador tiene costos por (tipo_producto + proveedor + estampado).
- JP tiene variantes en BD con `costo_base = 0` (las que importó del inventario sin costo).
- Para cada variante con `costo_base = 0`: buscar en el Cotizador el costo base correspondiente al (tipo, proveedor) y actualizar.
- `costo_adicional` se recalcula automático con `parametros_costo`.

**Implementación**: script `scripts/aplicar-costos-cotizador.mjs` que:
1. Lee la hoja Cotizador.
2. Construye un mapa `(tipo, proveedor) → costo_base`.
3. Para cada variante con costo_base=0, busca match y actualiza.

---

## Validación cruzada post-import

Después de cargar todo, este query debería dar 0 desalineadas:

```sql
-- Stock cuadra: entradas (pedidos recibidos + import inicial) − salidas (ventas) = stock_cache
select * from fn_reconciliar_stock();
```

Y un check adicional manual:

```sql
-- Total movido históricamente
select
  tipo,
  sum(cantidad) as total
from movimientos_inventario
where referencia_tipo in ('import_inicial','import_historico','pedido','venta')
group by tipo
order by tipo;
```

---

## Auto-cálculo de costos (gap operacional)

JP pidió: "el sistema con los costos de esa info pueda calcular costos de prendas subidas desde inventario o agregadas directamente".

**Estado actual**:
- `costo_total = costo_base + costo_adicional` (columna generada).
- `costo_adicional` se calcula automático al crear variante desde `parametros_costo`.
- `parametros_costo` está editable en `/admin/config`.

**Gap**:
- Variantes importadas con `costo_unit = 0` (sin costo del Sheet) → `costo_base = 0` → margen incorrecto.

**Solución dual**:
1. **Filtro "Sin costo"** en `/admin/variantes` ya implementado para identificarlas.
2. **Script para aplicar Cotizador** (próxima sesión).
3. **Pre-popular en el form de crear variante**: al elegir tipo + proveedor, sugerir `costo_base` desde el Cotizador (UI nueva, próxima sesión).

---

## Plan de ejecución

### Sesión actual
1. ✅ Deploy fixeado en Vercel.
2. ✅ Documentación (este archivo).
3. **Importer de Gastos en UI** (`/admin/gastos` → botón "Importar").
   - Soporta xlsx con header en row 0.
   - Detecta fila × 3 socios y agrupa como `equitativa`.
   - Mapea categoría por nombre.
   - Preview con conteo de filas crudas vs gastos consolidados.
   - Apply atómico vía insert directo (con `notas='import_sheet'`).

### Próxima sesión
4. Script `import-pedidos-historico.mjs` con safeguards.
5. Script `import-ventas-historico.mjs` con cálculo de stock objetivo.
6. Script `aplicar-costos-cotizador.mjs` para variantes sin costo.
7. Validación cruzada (`fn_reconciliar_stock` debe dar 0).
8. Ajustes finos: si quedan SKUs sin match, lista para JP.

### Sesión después (post-data real)
9. Bloque C — Bot Telegram (`07-bot-telegram.md`).
10. Bloque B4 — Cerrar RLS antes de invitar Kathe/Andrés.
11. F2 — Dashboard con costos fijos + proyección financiera.
