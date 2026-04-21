# ORVANN Gestión — Plan de Fases

Sistema operativo integral para ORVANN (tienda streetwear Medellín) que reemplaza el Google Sheet actual. Arquitectura pensada para replicarla a otros negocios retail similares.

**Tres superficies**:
- **Admin web** (escritorio): catálogo, pedidos, gastos, clientes, dashboard, reportes. Ven todo: costos, márgenes, finanzas.
- **POS móvil (PWA)**: el vendedor vende con 3 taps. No ve costos ni dashboard.
- **Bot Telegram** (F3): consultas rápidas y registro por chat.

**Estilo visual**: 100% fiel a DURATA (`C:\Personal\Negocios\DURATA\durata_crm`). Paleta, tipografía, layout, componentes idénticos. Cuando ORVANN necesite primitivas nuevas (ej. grilla visual del POS) se construyen con los tokens de DURATA sin inventar estilos.

---

## Fase 1 — Núcleo operativo (3-4 semanas)

**Objetivo**: que la tienda venda y registre gastos desde el sistema, cerrando el Sheet para operación diaria.

### Entregables

**E1 — Schema Supabase completo**
Aplicado al proyecto `nldctykjvyqsggwvweeh` (reset previo). Todas las tablas, enums, triggers, funciones, índices, policies RLS abiertas, bucket `comprobantes`, seed (proveedores, categorías, parámetros de costo, diseños). Ver `01-modelo-datos.md`.

**E2 — Catálogo (Admin)**
- CRUD `productos` (prenda / fragancia / accesorio / otro).
- CRUD `disenos`.
- CRUD `variantes` con cálculo automático de `costo_adicional` vía `parametros_costo` al elegir estampado/etiquetas/empaque. Breakdown visible antes de guardar.
- Subida de imagen por variante a Storage.
- Listado con buscador, filtros (tipo, stock bajo, sin imagen, inactivas), paginación server-side.
- **Importación CSV** de variantes (prioritario para cargar inventario físico el primer día).

**E3 — Pedidos a Proveedor (Admin)**
- Crear pedido con items (pueden empezar sin `variante_id`, descripción libre).
- Marcar pago y fecha de pago.
- **Recepción guiada**: al llegar mercancía, modal por item sin mapear; permite buscar variante existente o crear al vuelo. Al confirmar, el trigger emite `entrada_pedido` por cada item.
- Listado con filtros por proveedor, estado_pago, mes.

**E4 — POS Móvil (PWA) base**
- Manifest + service worker (instalable Android/iOS).
- Login: email + password Supabase Auth. Logo ORVANN (`docs/imagenes/ORVANN.png`).
- Topbar: logo + nombre vendedor + carrito con badge + menú usuario.
- Grilla de variantes activas: cards (imagen, nombre corto, precio, stock), 2 columnas móvil / 4 tablet.
- Buscador sticky + chips de filtro por tipo_producto.
- Modal detalle variante: imagen grande, precio editable, agregar al carrito.
- Carrito: lista de items, editar cantidad, eliminar.
- El POS **no muestra costos, márgenes, ni dashboard**.

**E5 — POS Cobro con pagos mixtos**
- Pantalla de cobro con N pagos por venta (tabla `venta_pagos`): agregar método + monto.
- Total = subtotal − descuento; visualiza "total / pagado / saldo". No confirma hasta que pagado = total.
- Botón "Aplicar descuento" con input de % o monto fijo + **motivo obligatorio**.
- En pago efectivo: input `efectivo_recibido`, muestra `vueltas` calculadas.
- En transferencia: input de referencia + botón "Subir foto de comprobante" → cámara → `browser-image-compression` → Storage bucket `comprobantes/{venta_id}/...`.
- Cliente opcional (buscador por nombre/teléfono; crear al vuelo si no existe).
- Confirmación: inserta `ventas + venta_items + venta_pagos`; triggers descuentan stock y actualizan cierre.

**E6 — Devoluciones y cambios (POS)**
Implementación según **Alternativa A** del modelo: cada devolución/cambio es una nueva fila de `ventas` vinculada por `venta_original_id`.
- Entrada en menú POS "Devoluciones".
- Buscar venta original (fecha / cliente / últimos 4 teléfono).
- Seleccionar items a devolver (parcial o total). Elegir método de reintegro (efectivo / transferencia).
- Al confirmar: crea `ventas` con `tipo_transaccion='devolucion'`, total negativo, items con `costo_unitario` copiado del original. Trigger emite `anulacion_venta` positivo en inventario.
- **Cambio** = devolución + venta nueva vinculadas al mismo `venta_original_id`. Muestra diferencia (a favor cliente o ORVANN).

**E7 — Offline cache del catálogo**
- Al abrir POS online, se descarga catálogo a IndexedDB.
- Service worker sirve catálogo cacheado si no hay red.
- Banner rojo persistente "Sin conexión — las ventas se habilitarán cuando vuelva internet" + botón reintentar.
- **No** se procesan ventas offline en F1 (ver Fase 1.5).

**E8 — Gastos (Admin)**
- Formulario reactivo: al cambiar `distribucion`, los campos de monto por socio se habilitan/deshabilitan y se recalculan.
- Validación con `zod` de que la suma cuadre (tolerancia ±1 peso).
- Listado con filtros por rango, categoría, pagador. Totales al pie (general / por socio / ORVANN).
- Exportación a CSV del listado filtrado.

**E9 — Clientes (Admin, minimalista)**
- Listado con buscador (nombre o teléfono). Columnas: nombre, teléfono, num_compras, total_comprado, última compra.
- Detalle con historial de compras (tabla de ventas del cliente).
- Creación manual (desde POS ya existe).

### Criterios de aceptación (12)

- [ ] JP sube 50+ variantes reales al sistema (UI o CSV) en <2h.
- [ ] JP registra 5 pedidos con sus recepciones sin errores.
- [ ] Vendedor sin contexto técnico instala la PWA y completa 10 ventas sin preguntar nada.
- [ ] `stock_cache` cuadra con conteo físico tras esas 10 ventas (diff=0).
- [ ] JP registra 20 gastos de meses pasados con distribución ÷3; totales por socio cuadran con el Sheet.
- [ ] Venta con pago mixto 30k efectivo + 50k transferencia con foto + 20k datáfono: 3 filas en `venta_pagos`, foto visible en admin.
- [ ] Devolución parcial (1 de 2 items): stock vuelve solo del devuelto.
- [ ] Cambio con diferencia de precio: registro refleja ambas filas vinculadas.
- [ ] Cobro efectivo con `efectivo_recibido > total`: vueltas correctas.
- [ ] Descuento global aplicado con motivo guardado.
- [ ] Pérdida de internet simulada: catálogo sigue visible y aparece banner.
- [ ] Todos los botones, inputs, tablas, modales, colores, tipografías indistinguibles de DURATA al ojo humano.

---

## Fase 1.5 — Offline real (2 semanas)

**Objetivo**: procesar ventas sin conexión y sincronizar al volver.

- Queue de ventas offline en IndexedDB.
- Worker de sync cada 30s cuando hay conexión.
- UI "ventas pendientes de sync" en POS.
- Manejo de conflictos: si al sincronizar no hay stock (otro dispositivo ya vendió la última), la venta queda en estado `conflicto` y notifica al admin.
- Tests de estrés: 50 ventas offline, sync, verificar que ninguna se pierde ni duplica.

---

## Fase 2 — Control financiero y cierres (2-3 semanas)

**Objetivo**: reemplazar las hojas "Caja Diaria", "Cierre de Caja", "Proyección" y "Resumen" del Sheet.

1. **Cierre de caja diario**
   - Apertura automática del `cierres_caja` del día con `efectivo_inicio = efectivo_contado` del anterior.
   - Campos calculados en vivo por triggers.
   - Pantalla de cierre: input de `efectivo_contado` + notas, calcula diferencia. Si >±5.000 COP pide motivo.
   - Historial con semáforo (verde cuadra / amarillo ±5k / rojo más).

2. **Consignaciones (Admin)**
   - Formulario (caja_tienda / aporte_socio / otro). Tabla con filtros por fecha y origen.
   - Trigger descuenta `consignaciones_salida` de `cierres_caja` cuando `origen='caja_tienda'`.

3. **Plan Separe (POS + Admin)**
   - Crear separe (variantes + cliente + total + abono inicial).
   - Registrar abonos. Al llegar a saldo=0, se convierte en venta real y descuenta stock.
   - Cancelación no mueve stock.

4. **Transformaciones (Admin)**
   - Registrar estampado de N unidades variante A → variante B (crea B al vuelo). Calcula costo_total de B como costo_base de A + estampado desde `parametros_costo`.

5. **Dashboard (Admin)**
   - KPIs: inventario a costo/venta, ventas mes vs mes anterior, gastos, utilidad bruta, ticket promedio, margen %, rotación, días de inventario, punto de equilibrio dinámico, aportes por socio.
   - Gráficas: ventas por día (30), por método, top diseños, top variantes.
   - Alertas: stock <3, pedidos sin pagar, descuadres >5k sin motivo, separes por vencer.

6. **Descuentos por ítem**
   - `venta_items.descuento_item`. UI en pantalla de cobro para aplicar descuento línea a línea.

7. **Venta a crédito con abonos**
   - UI sobre tablas `venta_abonos` + `ventas.es_credito / saldo_pendiente` (ya existen en F1).

8. **Domicilios / envíos**
   - UI sobre tabla `entregas` (ya existe en F1). Estados: pendiente / en_ruta / entregado / devuelto.

9. **Comisión de datáfono**
   - UI en admin para configurar % por pasarela. Trigger calcula `venta_pagos.comision_pasarela` al registrar.

10. **Escaneo código de barras**
    - `@zxing/browser` en POS para lectura con cámara. Generador de stickers de SKU desde admin.

11. **Recibo al cliente (WhatsApp link)**
    - URL pública de solo lectura del ticket con deep link a WhatsApp.

12. **Audit log**
    - Trigger genérico sobre `productos`, `variantes`, `gastos`, `parametros_costo`. Tabla ya creada en F1.

13. **Reportes**
    - Exportación CSV/XLSX de ventas, gastos, inventario, cierres por rango.

### Criterios de aceptación F2

- [ ] Primer cierre de caja real cuadra y queda guardado en <2 min.
- [ ] Consignación de efectivo refleja correctamente en el cierre del día.
- [ ] Plan separe: crear, 2 abonos, completar, stock descuenta solo al completar.
- [ ] Dashboard muestra KPIs equivalentes al Resumen del Sheet, con datos vivos.
- [ ] Transformación (camisa L blanca → estampada Pulp) registra nueva variante con costo correcto.
- [ ] RLS cerradas: vendedor NO ve costos ni gastos.

---

## Fase 3 — Bot Telegram con Gemini 2.5 Flash (1-2 semanas)

- **Webhook Vercel** (`/api/telegram-orvann`), sin polling.
- **Clasificador** (Gemini 2.5 Flash) con intenciones:
  - `consulta_ventas`, `consulta_stock`, `consulta_gastos`, `consulta_cliente`, `consulta_kpi`.
  - `registro_venta`, `registro_gasto`, `registro_consignacion`.
- **Autorización** por `profiles.telegram_chat_id`. Chats desconocidos: mensaje "no autorizado" + log en `bot_logs`.
- **Confirmación** para acciones que modifican estado (resumen + "OK" antes de persistir).
- **Alertas proactivas**: stock bajo, cierre pendiente, descuadre no justificado.
- Respuestas en Markdown corto con formato colombiano (`$1.250.000`).

### Criterios de aceptación F3

- [ ] "ventas hoy" → respuesta correcta <2s.
- [ ] "stock hoodie acid wash L" → número correcto.
- [ ] "vendí 2 boxy negras M a 70 mil efectivo" → resumen, OK, venta creada, stock descuenta.
- [ ] Chat desconocido recibe "no autorizado" y queda loggeado.

---

## Fase 4 — Shopify sync (2-3 semanas)

- Webhook Shopify → sistema (orders crean `ventas canal='shopify'`, mapea/crea cliente, descuenta stock).
- Sistema → Shopify (ventas presenciales actualizan inventory).
- Catálogo: productos/variantes se crean una vez en el sistema y se publican a Shopify con un botón.
- Mapeo de métodos de pago (credit_card/wompi → enum interno).
- Reconciliación nocturna: cron diario compara stocks y reporta discrepancias.

### Criterios de aceptación F4

- [ ] Order online aparece en dashboard como `canal='shopify'`.
- [ ] Venta en tienda baja inventario Shopify sin intervención.
- [ ] Crear + publicar producto nuevo a Shopify toma <1 min.

---

## Fase 5 — Expansión (diferida)

Cuando el negocio escale: cuentas por pagar con alertas, eventos/pop-ups con tag, analítica avanzada (atribución canal, cohortes), reportes tributarios DIAN, multi-marca/multi-tienda. Diferidas: apertura/cierre por denominación, arqueo intermedio, multi-terminal, gift cards, redondeo auto, propinas, puntos, comisiones a vendedor, heatmap por hora.

---

## Timeline

| Fase | Duración | Acumulado |
|------|----------|-----------|
| F1   | 3-4 sem  | 3-4 sem   |
| F1.5 | 2 sem    | 5-6 sem   |
| F2   | 2-3 sem  | 7-9 sem   |
| F3   | 1-2 sem  | 8-11 sem  |
| F4   | 2-3 sem  | 10-14 sem |

Paralelo a cierre de DURATA. No hay deadline externo; la estimación sirve para detectar si algo se estira más del doble.

---

## Fuera de alcance (no se hace)

- Facturación electrónica DIAN (cuando apliquen obligados).
- Multi-moneda, multi-tienda, multi-bodega.
- Gift cards, programa de puntos, propinas, redondeo automático.
- Siigo/Alegra.
- App nativa iOS/Android (la PWA basta).
- Migrar el inventario del Sheet tal cual (JP hace inventario físico, ese es el punto cero).
- Railway / n8n / Zapier (todo en Vercel serverless + Supabase).
