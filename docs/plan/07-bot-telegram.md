# ORVANN Gestión — Bot de Telegram (Bloque C)

> Plan de implementación del bot de Telegram (Fase 3) que ejecuta consultas y registros desde el chat con clasificación de intenciones por Gemini 2.5 Flash. Se realiza después de tener data viva fluyendo en producción (post-Bloque B).

---

## Por qué se hace ahora (no antes)

- **Notificaciones push reales**: el `AdminRealtimeNotifier` actual solo dispara con la app abierta. El bot puede mandar push al cel cuando la app está cerrada.
- **Consultas rápidas sin abrir el sistema**: "stock hoodie L" o "ventas hoy" desde el chat.
- **Registros fuera de horario**: gastos o consignaciones sin entrar a la app.

---

## Arquitectura

```
                 ┌──────────────────┐
   Telegram     │  BotFather       │
   ↑↓ webhook   │  bot @orvann_*   │
                └────────┬─────────┘
                         │ HTTPS POST
                         ▼
              ┌──────────────────────┐
              │  Vercel Serverless   │
              │  /api/telegram-orvann│
              │   (Node runtime)     │
              └──────────┬───────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
   ┌────────────┐  ┌──────────┐  ┌─────────┐
   │  Gemini    │  │ Supabase │  │  bot_   │
   │  classify  │  │  RPC/DML │  │  logs   │
   └────────────┘  └──────────┘  └─────────┘
```

---

## Archivos a crear

```
api/
└── telegram-orvann.ts          # Vercel serverless function (entrypoint)

src/lib/telegram/
├── auth.ts                     # Verificar chat_id contra profiles
├── classifier.ts               # Llamada a Gemini con prompt
├── intents/
│   ├── consulta-ventas.ts      # "ventas hoy", "ventas de mayo"
│   ├── consulta-stock.ts       # "stock hoodie L"
│   ├── consulta-gastos.ts      # "gastos del mes"
│   ├── consulta-cliente.ts     # "compras de Juana"
│   ├── consulta-kpi.ts         # "kpi del mes"
│   ├── registro-venta.ts       # "vendí 2 boxy negras a 70k efectivo"
│   ├── registro-gasto.ts       # "gastamos 50k en papelería"
│   └── registro-consignacion.ts
├── format.ts                   # formatCOP, fechas, markdown
└── confirmation.ts             # Pattern de confirmación con "OK"
```

---

## Variables de entorno (Vercel + .env.local)

| Variable | Origen | Uso |
|----------|--------|-----|
| `TELEGRAM_BOT_TOKEN` | BotFather al crear el bot | Llamadas a `api.telegram.org/bot{TOKEN}/...` |
| `TELEGRAM_WEBHOOK_SECRET` | Generar uuid random | Validar header `X-Telegram-Bot-Api-Secret-Token` |
| `GEMINI_API_KEY` | Google AI Studio | `@google/generative-ai` SDK |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API | Cliente con permisos elevados (bypassa RLS) |
| `SUPABASE_URL` | (ya existe) | Endpoint de la DB |

---

## Flujo de mensaje (alto nivel)

1. Usuario manda mensaje al bot.
2. Telegram dispara webhook a `/api/telegram-orvann`.
3. Validar firma + chat_id autorizado:
   - Si no autorizado → "no autorizado" + log en `bot_logs`.
4. Clasificar intención con Gemini:
   ```
   prompt: "Clasificá este mensaje en una de las intenciones: {intents}.
            Mensaje: {text}.
            Respondé con JSON: {intent, params, confidence}"
   ```
5. Si `intent` es de **consulta**: ejecutar query, formatear, responder.
6. Si `intent` es de **registro**: armar resumen + pedir "OK".
7. Si usuario responde "OK" en mensaje siguiente: persistir + confirmar.
8. Loggear todo en `bot_logs` (mensaje, intent, params, latencia, error).

---

## Intenciones detalladas

### Consultas

| Intent | Ejemplos | Respuesta |
|--------|----------|-----------|
| `consulta_ventas` | "ventas hoy", "ventas de mayo", "ventas de la semana pasada" | Total + count + breakdown por método |
| `consulta_stock` | "stock hoodie acid wash L", "boxy negra M" | Variantes coincidentes con stock |
| `consulta_gastos` | "gastos de este mes", "qué pagó Kathe en abril" | Total + breakdown por categoría/socio |
| `consulta_cliente` | "compras de María Pérez", "cliente 3104567890" | Historial resumido |
| `consulta_kpi` | "kpi", "cómo vamos", "resumen del mes" | Bruto/neto/ticket promedio/margen/crédito pendiente |

### Registros

| Intent | Ejemplos | Confirmación |
|--------|----------|--------------|
| `registro_venta` | "vendí 2 boxy negras M a 70k efectivo" | Resumen: "2 BOX-NEG-M × $70k = $140k. ¿OK?" |
| `registro_gasto` | "gasté 50k en papelería" | Resumen: "Gasto $50k · Otros · efectivo · ORVANN. ¿OK?" |
| `registro_consignacion` | "consigné 200k de la caja" | Resumen: "Consignación $200k · caja_tienda. ¿OK?" |

---

## Alertas proactivas (cron)

Vercel cron job `/api/cron/telegram-alertas` corre cada hora/día:

- **Stock bajo**: variantes con `stock_cache < 3` y activas → mandar lista a JP.
- **Cierre pendiente**: si pasaron las 22:00 y no hay `cierres_caja.cerrado=true` del día → recordatorio.
- **Crédito vencido**: ventas con `es_credito=true` y `created_at` > 30 días → lista de cobranza.
- **Descuadre no justificado**: `cierres_caja.diferencia` con valor absoluto > 5.000 sin nota.

---

## Plan de sesión (estimado: 1-2 sesiones de 2-3h)

### Sesión 1 — Setup + 2 intenciones MVP

1. **Setup serverless**: `api/telegram-orvann.ts` con echo + validación firma.
2. **BotFather**: crear bot, configurar webhook con secret.
3. **Auth**: verificar chat_id contra `profiles.telegram_chat_id` + agregar columna si hace falta.
4. **Logging**: insertar fila en `bot_logs` por cada interacción.
5. **Clasificador con Gemini**: prompt + parsing del JSON.
6. **Intent `consulta_ventas`** (read-only, simple).
7. **Intent `consulta_stock`** (read-only, con buscador fuzzy).
8. Deploy a Vercel.

### Sesión 2 — Registros + alertas

9. **Pattern de confirmación** (estado en sesión via `bot_logs.parametros_json`).
10. **Intent `registro_venta`** (crítico, con confirmación).
11. **Intent `registro_gasto`**.
12. **Cron de alertas**: stock bajo + cierre pendiente.
13. **Tests manuales** end-to-end con JP.

---

## Decisiones a tomar antes de arrancar

| # | Decisión | Default propuesto |
|---|----------|-------------------|
| 1 | ¿Webhook o polling? | **Webhook** (Vercel serverless es perfecto). |
| 2 | ¿Idioma y formato? | **Español Colombia**, montos `$1.250.000`. |
| 3 | ¿Quién está autorizado al inicio? | Solo JP (`profiles.rol='admin'`). Después se agregan socios. |
| 4 | ¿Si Gemini clasifica con `confidence < 0.7`, qué hacer? | Pedir aclaración: "No entendí bien. ¿Querés…?" con opciones. |
| 5 | ¿Notificaciones por defecto? | Stock bajo cada mañana 09:00 + descuadre detectado en tiempo real. |

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Gemini API costos | Cache de queries comunes (consulta_kpi cada 5 min); rate-limit por chat. |
| Webhook caído | Telegram reintenta automáticamente; agregamos timeout + log. |
| Mensajes ambiguos generan registros incorrectos | Confirmación obligatoria con "OK" para todo registro. |
| Service role key expuesto | Solo en Vercel env vars; nunca en código cliente. |
| Spam de no autorizados | Rate limit por chat_id desconocido. |

---

## Salida esperada

Al cierre del Bloque C:
- Bot operativo en Telegram con auth.
- 5 intenciones de consulta + 3 de registro funcionando.
- Confirmación obligatoria en registros.
- Alertas proactivas diarias.
- `bot_logs` con telemetría completa.
- Documentado en este archivo + casos en `04-qa-plan.md`.
