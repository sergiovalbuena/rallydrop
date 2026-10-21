# RallyDrop — Plan de implementación

App de alquiler de máquinas lanzabolas en Victoria, BC. Este documento es la
propuesta **previa a escribir código**. El modelo de datos está en
[`prisma/schema.prisma`](../prisma/schema.prisma) y las restricciones SQL extra al final de la
migración inicial (`prisma/migrations/*_init/migration.sql`).

## 0. Repositorio

Proyecto independiente en su propio repositorio, con la app Next.js en la raíz
y su propio proyecto de Vercel.

## 1. Stack (versiones estables a oct-2026)

| Área | Elección |
|---|---|
| Framework | Next.js 16 (App Router, TS strict, Server Actions, `proxy.ts`) |
| UI | Tailwind v4 + shadcn/ui + lucide-react, `next-themes` (claro/oscuro) |
| Tipografía | Titulares: *Barlow Condensed* 700/800 · Texto: *Inter* (Google Fonts vía `next/font`) |
| DB | PostgreSQL (Neon o Supabase) + Prisma 7.10 (`prisma-client` generator, `prisma.config.ts`) |
| Auth admin | Auth.js v5 (`next-auth@beta`) + `@auth/prisma-adapter`; credenciales (argon2) + magic link vía Resend; solo rol `ADMIN/STAFF` |
| Auth cliente | Propia y ligera: OTP de 6 dígitos o magic link (email por Resend, SMS por Twilio si hay flag) → cookie httpOnly con token hasheado en DB |
| Pagos | Stripe (CAD) — Payment Element + PaymentIntents, Subscriptions, webhooks |
| Emails | Resend + React Email |
| SMS | Twilio, detrás de `SMS_ENABLED` + credenciales |
| i18n | `next-intl`, `messages/en.json` (estructura lista para `es.json`) |
| Validación / fechas | Zod 4 · date-fns + date-fns-tz (`America/Vancouver`) |
| Cron | Vercel Cron → rutas `/api/cron/*` protegidas con `CRON_SECRET` |
| Fotos check-in | Vercel Blob (o Supabase Storage) |
| Tests | Vitest (unit) + tests de integración contra Postgres real (Docker/CI) |

## 2. Decisiones clave de diseño

### Dinero e impuestos
- Todo en **centavos enteros** CAD; porcentajes en **basis points** (GST 500, PST 700).
- `lib/pricing.ts` es una función pura: `quote({ product, addOns, deliveryPoint, settings, machine })`
  → `{ lines[], subtotal, gst, pst, total, deposit }`. Redondeo por línea de impuesto, *half-up*.
  Comentario en el código: *el dueño debe confirmar tasas y si el PST aplica a alquiler de equipo con su contador*.
- La reserva guarda un **snapshot** del precio: cambiar precios en el admin nunca altera reservas existentes.
- Entrega gratis si la distancia (haversine) al centro configurado ≤ radio; si no, +$15.

### Disponibilidad y doble reserva
- Una sola tabla `MachineOccupancy` registra todo lo que ocupa una máquina: reservas,
  sesiones de grupo y bloqueos del admin. Cada fila guarda el bloque **ya con el margen**
  (2 h por defecto, antes y después).
- Postgres lo garantiza con `EXCLUDE USING gist (machineId =, tstzrange &&) WHERE active`.
  Verificado localmente: rechaza solapes, permite bloques contiguos e ignora filas inactivas.
- **Reserva temporal de 10 min**: la reserva nace `PENDING_PAYMENT` con `holdExpiresAt`.
  Dentro de la misma transacción, antes de insertar, se desactivan los holds vencidos que
  solapan; si el INSERT viola la restricción → "Ese horario se acaba de ocupar".
  Un cron cada 5 min marca `EXPIRED` las reservas vencidas y cancela su PaymentIntent.
- El calendario público consulta un endpoint que calcula huecos libres por máquina
  respetando: ocupaciones, bloqueos, temporada, horario de entrega, antelación mínima y máxima.

### Productos y horarios
| Producto | Cómo se reserva |
|---|---|
| Día | fecha → franja de entrega; 24 h |
| Fin de semana | solo sáb → recogida lunes por la mañana |
| Semana / Mes | fecha de inicio; 7 / 30 días |
| Paquetes Básico/Frecuente | suscripción Stripe; luego el cliente reserva sesiones de 1.5 h desde el portal, descontando del cupo del periodo |
| Sesión de grupo | inscripción a una `GroupSession` (cupo con bloqueo de fila); la sesión ocupa la máquina |

### Depósito (sección 4 del brief)
1. **Alquiler ≤ 6 días y empieza en ≤ 24 h** → PaymentIntent separado `capture_method: manual`
   por el monto del depósito de la máquina. Estado `HELD`.
2. **Alquiler ≤ 6 días pero reservado con mucha antelación** → *ajuste importante*: una
   autorización caduca a los ~7 días, así que si la reservan para dentro de 3 semanas el hold
   caducaría antes de usarse. Propuesta: al reservar se **guarda la tarjeta** (SetupIntent /
   `setup_future_usage: off_session`) y un cron crea el hold manual off-session
   `depositAuthLeadHours` (24 h) antes de la entrega. Si falla → `FAILED`, aviso al admin y al
   cliente para actualizar la tarjeta antes de entregar.
3. **Semana / mes** → solo tarjeta guardada (`SAVED_CARD`); el admin cobra off-session solo si hay daños.
- Estado `Devuelta – OK` ⇒ se cancela el PaymentIntent automáticamente (`RELEASED`) + email.
- `Devuelta – Daños` ⇒ el admin captura total/parcial (`amount_to_capture`) o cobra off-session
  con **nota obligatoria** (también CHECK en DB).
- Alquiler y depósito son PaymentIntents distintos sobre el mismo `Customer` de Stripe; el pago
  del alquiler usa `setup_future_usage: off_session` para reutilizar la tarjeta sin pedirla dos veces.

### Webhooks Stripe (`/api/stripe/webhook`)
Verificación de firma, idempotencia por `StripeEvent.id`, y transiciones:
`payment_intent.succeeded` (confirma reserva/inscripción, envía email),
`payment_intent.amount_capturable_updated` (depósito `HELD`),
`payment_intent.canceled` / `payment_failed`, `charge.refunded`,
`setup_intent.succeeded`, `invoice.paid` / `invoice.payment_failed`,
`customer.subscription.created|updated|deleted`.

### Cancelación y reprogramación
- > 48 h: reembolso 100 % · < 48 h: 50 % (configurable). Siempre se libera el depósito.
- Reprogramar = mover la fila de ocupación en una transacción (la restricción protege igual).
  El admin puede arrastrar en el calendario maestro con la misma lógica.

## 3. Estructura de carpetas

```
rallydrop/
  prisma/ schema.prisma · sql/ · seed.ts · migrations/
  messages/ en.json
  public/ brand/ (logo-light.svg, logo-dark.svg, mark.svg) · favicon
  src/
    config/brand.ts            ← BRAND_NAME y datos de marca en un solo lugar
    app/
      [locale]/(marketing)/     inicio, machines, pricing, group-sessions, how-it-works, contact, terms, privacy
      [locale]/book/            asistente de reserva (pasos) + confirmation/[code]
      [locale]/account/         portal cliente (login OTP, reservas, paquete, guía)
      admin/                    dashboard, calendar, bookings, machines, customers, groups, settings, export
      api/ stripe/webhook · cron/* · availability · export/*.csv · auth/[...nextauth]
    components/ ui/ (shadcn) · brand/ · booking/ · admin/ · marketing/
    lib/
      pricing.ts · availability.ts · booking-service.ts · deposit-service.ts
      stripe.ts · email/ (React Email templates) · sms.ts · otp.ts · geo.ts · time.ts · csv.ts
      validation/ (esquemas Zod compartidos cliente/servidor)
    generated/prisma/
  tests/ unit/ (pricing, availability, cancellation) · integration/ (doble reserva, webhooks)
```

## 4. Etapas (cada una compila, pasa lint/typecheck/tests y se commitea)

1. **Base** — scaffold Next 16, Tailwind/shadcn, fuentes, tema, `brand.ts`,
   next-intl, Prisma + migración inicial + SQL extra, seed (Aura, Pace S como "próximamente",
   productos, add-ons, canchas de Victoria, admin de ejemplo), `.env.example`.
2. **Identidad** — logo SVG original (pelota con costura convertida en línea de cancha +
   trayectoria), versión clara/oscura, favicon, paleta: azul cancha profundo, azul eléctrico,
   amarillo óptico, blanco; líneas de cancha como motivo gráfico. Nada de marcas de torneos.
3. **Lógica de dominio + tests** — pricing, impuestos, zona de entrega, cálculo de huecos,
   servicio de reservas con hold/expiración, política de cancelación. Tests unitarios y de
   integración de doble reserva concurrente.
4. **Sitio de marketing** — las 7 páginas, mobile-first, skeletons, estados vacíos, accesibilidad.
5. **Flujo de reserva + Stripe** — asistente (producto → máquina → calendario → add-ons/entrega →
   datos → pago con Payment Element), depósito según estrategia, webhooks + tests, emails Resend.
6. **Portal del cliente** — OTP/magic link, reservas, estado del depósito, recibos, cancelar,
   reprogramar, paquetes (suscripción, sesiones restantes, Customer Portal de Stripe para la tarjeta), guía rápida.
7. **Admin** — Auth.js, dashboard, calendario maestro (mes/semana/día, drag & drop, bloqueos,
   reservas manuales), reservas con check-out/check-in y fotos, máquinas + mantenimiento,
   clientes, sesiones de grupo, configuración, export CSV.
8. **Cron y notificaciones** — expirar holds, recordatorio 24 h, holds de depósito diferidos, SMS opcional.
9. **Pulido y entrega** — README (local, Vercel, Stripe CLI, tarjetas de prueba), checklist de pendientes.

## 5. Preguntas abiertas (tengo defaults; corrígeme si alguno no te sirve)

1. **Franjas de entrega del alquiler por día**: default 24 h desde la entrega elegida (p. ej.
   10:00 → 10:00 del día siguiente). ¿O prefieres "día calendario" (entrega mañana, recogida por la tarde)?
2. **Fin de semana**: entrega viernes tarde o sábado mañana → recogida lunes mañana. Default: sábado 09:00 → lunes 09:00.
3. **Depósito diferido** (punto 2 del depósito): ¿OK con guardar tarjeta y autorizar 24 h antes?
4. **Paquetes**: ¿las sesiones de paquete incluyen entrega en cancha, o el cliente recoge? Default: incluye entrega en cancha dentro de la zona gratis.
5. **Proveedor DB**: Neon (default, mejor encaje con Vercel) o Supabase.
