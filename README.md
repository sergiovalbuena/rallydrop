# RallyDrop

Alquiler de máquinas lanzabolas de tenis y pickleball en Victoria, BC. Incluye:

- **Sitio público**: inicio, máquinas, precios, sesiones de grupo, cómo funciona/FAQ, contacto, términos y privacidad.
- **Reserva sin cuenta**: calendario con disponibilidad real, add-ons, entrega a domicilio o en cancha, pago con Stripe y depósito.
- **Portal del cliente sin contraseña**: acceso con código de un solo uso o enlace mágico.
- **Panel de administración** completo.

> El nombre de marca está en un solo archivo: [`src/config/brand.ts`](src/config/brand.ts).
> El logo vive en `src/components/brand/logo.tsx` y `public/brand/*.svg`.

## Stack

| | |
|---|---|
| App | Next.js 16.4 (App Router, Cache Components, Server Actions), React 19, TypeScript estricto |
| UI | Tailwind CSS 4, componentes estilo shadcn/ui sobre Radix, lucide-react, Barlow Condensed + Inter |
| Datos | PostgreSQL (Neon) + Prisma 7 (`@prisma/adapter-pg`) |
| Pagos | Stripe: Payment Element, PaymentIntents, depósitos con captura manual, Subscriptions, webhooks |
| Email / SMS | Resend; Twilio (opcional, sin SDK) |
| Auth | Auth.js v5 para el admin; OTP / magic link propio para clientes |
| i18n | next-intl (`messages/en.json`, preparado para añadir `es.json`) |
| Validación / fechas | Zod 4, date-fns + date-fns-tz |
| Tests | Vitest: unitarios + integración contra Postgres real |

## Estructura

```
prisma/            schema, migraciones (con la restricción de exclusión anti doble reserva), seed
messages/en.json   todos los textos del sitio
src/config/        marca
src/app/(site)/    sitio público, /book (reserva), /account (portal)
src/app/admin/     login y panel (dashboard, calendario, reservas, máquinas, clientes, grupos, precios, ajustes, export)
src/app/api/       availability, stripe/webhook, cron/[job], export CSV, .ics, auth
src/lib/domain/    lógica pura: precios/impuestos, disponibilidad, depósito, cancelación, zona de entrega
src/lib/services/  reservas, pagos/depósitos, suscripciones, grupos, webhooks, portal, cron
src/lib/notify/    plantillas de email, envío por Resend/Twilio con deduplicación
tests/             unit/ e integration/ (doble reserva concurrente, webhooks Stripe, cron)
```

## Cómo funciona lo importante

- **Doble reserva imposible.** Todo lo que ocupa una máquina (reservas, sesiones de grupo, días bloqueados) es una fila en `MachineOccupancy`.
  - Postgres impide solapes con `EXCLUDE USING gist (machineId =, tstzrange &&)`.
  - Cada reserva bloquea `[inicio, fin + margen)`. El margen es de 2 h por defecto y se puede configurar.
  - Mientras el cliente paga, el horario queda retenido 10 minutos.
  - Un *advisory lock* por máquina evita deadlocks cuando llegan muchas peticiones simultáneas.
- **Depósito.** Se elige según la duración del alquiler:

  | Alquiler | Qué se hace con la tarjeta |
  |---|---|
  | Hasta 6 días | Retención con `capture_method: manual`. Si empieza en más de 24 h, la tarjeta se guarda al pagar y la retención se coloca 24 h antes. |
  | Semana o mes | Solo se guarda la tarjeta (`setup_future_usage: off_session`). |

  - Marcar **"Returned – OK"** libera el depósito automáticamente.
  - Con daños, el admin cobra el depósito total o parcialmente, con una nota obligatoria que se envía por email al cliente.
  - Las reservas telefónicas no tienen tarjeta: el depósito se gestiona en persona.
- **Precios.** Se calculan siempre en el servidor, en centavos, y se guarda una copia en cada reserva.
  - GST y PST se configuran en el admin. ⚠️ **Confírmalos con tu contador**, sobre todo si el PST aplica al alquiler de equipo.
- **Zona horaria `America/Vancouver`.** Columbia Británica pasa a horario permanente UTC-7 desde el 1 de noviembre de 2026 (tzdata 2026e).
  - `src/lib/time.ts` lo aplica aunque el runtime tenga datos de zona horaria antiguos.

## Correr en local

Requisitos: Node 20.9+ y PostgreSQL 16+ (local, Docker o Neon).

```bash
npm install                       # también genera el cliente de Prisma
cp .env.example .env              # completa al menos DATABASE_URL, AUTH_SECRET, PORTAL_SECRET
npx prisma migrate deploy         # crea las tablas + restricción de exclusión
npm run db:seed                   # máquinas, productos, canchas, sesiones de grupo y el usuario admin
npm run dev                       # http://localhost:3000
```

- **Admin**: http://localhost:3000/admin con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Por defecto son `owner@example.com` / `change-me-please`; cámbialos.
- **Sin `RESEND_API_KEY`**: los emails, incluidos los códigos del portal, se imprimen en la consola del servidor.
- **Fuera de Vercel con `next start`**: añade `AUTH_TRUST_HOST=true`.

### Comprobaciones y tests

```bash
npm run typecheck && npm run lint && npm run format:check
npm test     # unitarios + integración
```

Los tests de integración usan una base aparte, `TEST_DATABASE_URL` en `.env` (por ejemplo `postgresql://…/rallydrop_test`). Se migra sola, se **vacía en cada test** y se omite si la variable no existe.

## Probar un pago con Stripe (modo test)

1. Crea una cuenta en Stripe y quédate en **modo test**. Copia `sk_test_…` y `pk_test_…` a `.env`.
   - En desarrollo la app se niega a usar claves `sk_live_`.
2. Instala la [Stripe CLI](https://docs.stripe.com/stripe-cli) y reenvía los webhooks:
   ```bash
   stripe login
   npm run stripe:listen     # copia el whsec_… que imprime a STRIPE_WEBHOOK_SECRET y reinicia `npm run dev`
   ```
3. Reserva en http://localhost:3000/book con estas tarjetas (cualquier fecha futura, cualquier CVC y código postal):

| Tarjeta | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago correcto. El depósito queda retenido sin cobrarse. |
| `4000 0025 0000 3155` | Pide 3-D Secure la primera vez; luego los cobros fuera de sesión funcionan. |
| `4000 0027 6000 3184` | Siempre pide 3-D Secure, así que el depósito diferido y el cobro de daños fallan. Sirve para ver el flujo "Action needed". |
| `4000 0000 0000 9995` | Rechazada por fondos insuficientes. |

4. Comprueba el resultado en Stripe → *Payments*:
   - El alquiler aparece cobrado.
   - El depósito aparece como **Uncaptured**.
5. En el admin → *Bookings* → la reserva:
   - Prueba **Returned – OK**: cancela la autorización.
   - Prueba **Charge deposit** con una nota: captura parcial.
6. Paquetes mensuales: `/pricing` → *Subscribe*. Cambia la tarjeta desde *My bookings* → *Update card*. Antes activa el [Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal) en Stripe.

Eventos de webhook necesarios:

- `payment_intent.succeeded`
- `payment_intent.amount_capturable_updated`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`

## Despliegue en Vercel + Neon

1. Crea la base en **Neon**. Copia la URL *pooled* a `DATABASE_URL` y la *direct* a `DIRECT_URL`.
2. Importa el repo en **Vercel** y añade todas las variables de `.env.example`:
   - `NEXT_PUBLIC_SITE_URL`: tu dominio.
   - `AUTH_SECRET`, `PORTAL_SECRET` y `CRON_SECRET`: secretos aleatorios.
   - Las claves de Stripe, Resend y, opcionalmente, Twilio.
3. *Build command*: `prisma migrate deploy && npm run build`. Para aplicar migraciones a mano en su lugar, ejecuta `npm run db:deploy`.
4. Ejecuta una vez `npm run db:seed` contra la base de producción, con `SEED_ADMIN_*` propios.
5. En Stripe (modo live, cuando toque), crea el endpoint `https://TU-DOMINIO/api/stripe/webhook` con los eventos de arriba.
6. Añade un **Blob store** en Vercel para las fotos de check-in/out. Crea `BLOB_READ_WRITE_TOKEN`.
7. **Cron** (`vercel.json`): expira retenciones cada 10 min, depósitos cada hora y recordatorios cada hora.
   - En el plan Hobby de Vercel los cron jobs son diarios. Usa el plan Pro o un cron externo que llame `GET /api/cron/all` con `Authorization: Bearer $CRON_SECRET`.
   - Las retenciones vencidas se liberan igualmente al reservar, así que no se bloquea nada aunque el cron tarde.

## Pendiente de configurar antes de lanzar

- [ ] **Claves reales**: Stripe live (y su webhook), Resend con el dominio verificado (`EMAIL_FROM`), `ADMIN_ALERT_EMAIL`, Twilio si quieres SMS.
- [ ] **Dominio** y `NEXT_PUBLIC_SITE_URL`. Revisa `brand.contact` (email, teléfono, Instagram) en `src/config/brand.ts`.
- [ ] **Textos legales**: `src/content/legal/*.en.tsx` son borradores. Requieren revisión por un abogado de BC (términos, responsabilidad por daños, PIPA/PIPEDA).
- [ ] **Impuestos**: confirma GST/PST con tu contador (Admin → Settings).
- [ ] **Datos de ejemplo**: specs de la PONGBOT Aura/Pace S, coordenadas de canchas, sesiones de grupo, testimonios (marcados como "Sample") y guía rápida (`/account/guide`). Verifícalos con el manual del fabricante.
- [ ] **Contraseña del admin**: cambia la del seed. Para magic link del admin hace falta `RESEND_API_KEY`.
- [ ] **Pickup**: añade la dirección de recogida al email de confirmación.
- [ ] **Stripe Customer Portal** activado para los paquetes.
- [ ] Opcional: fotos reales de las máquinas (Admin → Machines) y textos editables (Admin → Settings → Site texts).

## Notas

- **Admin en inglés.** Los textos del admin están en el código; los del sitio público están en `messages/en.json`.
- **Componentes UI.** Los componentes de `src/components/ui` siguen el estilo de shadcn/ui. `components.json` está listo para `npx shadcn add …`.
- **Geocodificación.** Las direcciones se geocodifican con OpenStreetMap Nominatim, que es gratis y tiene límite de uso justo.
  - Si falla, la zona gratis se decide por el código postal (FSA) listado en `brand.ts`.
