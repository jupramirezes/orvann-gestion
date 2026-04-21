# ORVANN Gestión

Sistema operativo integral para **ORVANN**, tienda de streetwear en Medellín. Reemplaza un Google Sheet multi-hoja por una app web (admin) + PWA móvil (POS) + bot Telegram (F3), todo sobre Supabase.

Arquitectura pensada para replicarse a otros negocios retail similares.

## Stack

- **Frontend**: React 19 + TypeScript estricto + Tailwind CSS v4 + Vite.
- **Backend / DB / Auth / Storage**: Supabase (proyecto `nldctykjvyqsggwvweeh`).
- **Deploy**: Vercel.
- **PWA**: manifest + service worker, instalable en Android/iOS.

## Superficies

| Superficie   | Para quién | Qué ve |
|--------------|------------|--------|
| Admin web    | Socios / administradores | Catálogo, pedidos, gastos, clientes, dashboard, reportes, costos. |
| POS móvil    | Vendedor en tienda | Grilla de productos, cobro con pagos mixtos, devoluciones. Sin costos ni márgenes. |
| Bot Telegram | Socios (F3) | Consultas rápidas y registro por chat con Gemini 2.5 Flash. |

## Documentación

Plan completo en [`docs/plan/`](docs/plan/):

- [`01-modelo-datos.md`](docs/plan/01-modelo-datos.md) — schema consolidado (fuente de verdad).
- [`02-plan-fases.md`](docs/plan/02-plan-fases.md) — fases F1 → F5 y criterios de aceptación.
- [`03-fase1-tareas.md`](docs/plan/03-fase1-tareas.md) — tareas operativas de Fase 1 + protocolo.
- [`seed-disenos.sql`](docs/plan/seed-disenos.sql) — 39 referencias culturales (diseños).

Referencias en [`docs/referencia/`](docs/referencia/):
- Google Sheet original (referencia histórica, NO se migra).
- `inventario-fisico-template.csv` — contrato de columnas del importador de variantes.

## Estilo visual

100% fiel al CRM `durata_crm` (repo en `C:\Personal\Negocios\DURATA\durata_crm`): paleta oklch cool-steel, tema claro, `lucide-react`, tokens Tailwind, layout con sidebar. Los componentes base se portan desde ese repo.

## Estado

En construcción. Fase 1 en curso. El branch `v2` reemplaza el enfoque v1 descartado que vive en `dev`.
