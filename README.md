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
- **Depósito.** Se elige según la duración del alquiler (montos por máquina en Admin → Machines):

  | Alquiler | Qué se hace con la tarjeta |
  |---|---|
  | Día y fin de semana | Al reservar se cobra el alquiler y se guarda la tarjeta. La retención de **$400** (`capture_method: manual`) la coloca el job horario **24 h antes del inicio** (o en el mismo checkout si faltan menos de 24 h), porque una retención con la tarjeta guardada dura solo 4 días y 18 h en Visa. El email de confirmación dice la fecha y se manda otro cuando se coloca. |
  | Semana o mes | Nunca se retiene: tarjeta guardada (`setup_future_usage: off_session`) para cobrar hasta **$600** si hay daños. |

  - **Si la retención falla** (tarjeta rechazada o vencida), el depósito queda en **"Deposit pending"**: el cliente recibe un enlace `/deposit/…` para poner otra tarjeta (se reintenta en el momento), el admin recibe un aviso y el check-out queda bloqueado hasta resolverlo (o hasta liberar el depósito para eximirlo).
  - El vencimiento real de cada retención sale de Stripe (`capture_before`). El dashboard lo muestra y avisa si vence antes de la devolución.

  - Marcar **"Returned – OK"** libera el depósito automáticamente.
  - Con daños, el admin cobra el depósito total o parcialmente, con una nota obligatoria que se envía por email al cliente. Si el cliente compró **RallyDrop Care**, el cobro máximo es $100 salvo que se marque una exclusión (robo, pérdida, lluvia, negligencia grave).
  - Check-out con checklist (máquina, Spotter, batería, cargador) y verificación manual de ID (últimos 4 dígitos de la licencia), obligatoria en semana/mes. Stripe Identity queda detrás de un ajuste, sin activar.
  - Las reservas telefónicas no tienen tarjeta: el depósito se gestiona en persona.
- **Temporadas.** Alta del 1 abr al 30 sep (editable en Settings, formato MM-DD). El precio sale de la fecha de inicio: día $50/$45, fin de semana $85/$75, semana $160/$140, mes $420/$300. Un cubo de bolas va incluido; cubo extra +$8. En temporada alta se puede limitar cuántos alquileres de mes se aceptan por mes (por defecto 1; 0 = no se ofrecen).
- **Términos y waiver (clickwrap).** Antes de pagar, dos casillas sin marcar (términos + waiver, y mayor de 19). El botón de pago queda desactivado hasta marcarlas. Cada aceptación guarda versión, SHA-256 del texto, IP, navegador y hora (`WaiverAcceptance`). Los textos viven versionados en `LegalDocument` (Admin → Terms & waiver) y nunca se borran. Ninguna reserva se confirma sin aceptación, tampoco desde el webhook: si el pago llega sin ella, el horario queda retenido y el cliente recibe un enlace `/accept/…` para aceptar. Las reservas telefónicas mandan ese enlace automáticamente.
- **Impuestos.** Apagados por defecto. GST/PST solo se cobran con el interruptor encendido **y** el número de registro guardado; si no, el sitio dice "Prices in CAD".
- **Precios.** Se calculan siempre en el servidor, en centavos, y se guarda una copia en cada reserva.
- **Códigos promocionales.** Se crean en Admin → Promo codes (% o monto fijo, fechas, usos máximos, tipos de alquiler). El cliente lo escribe justo antes de pagar; el descuento se aplica antes de impuestos, nunca baja el cobro de $1 (el pago con tarjeta es lo que guarda la tarjeta para el depósito) y no afecta el depósito. El seed crea `FIRSTSERVE` (10%) para probar.
- **Entrega y recogida (pagadas).** Recoger y devolver en el punto del centro es gratis. Si el cliente prefiere, compramos los trayectos: *drop-off* (la llevamos), *collection* (la recogemos) o ambos (ida y vuelta, más barato que dos viajes). Precio fijo por trayecto según la distancia en línea recta desde el centro: zona 1 hasta 5 km ($15 / $25 ida y vuelta), zona 2 hasta 12 km ($25 / $40), zona 3 hasta 20 km ($35 / $60); más lejos solo autoservicio online. Todo editable en Admin → Settings.
- **Paquetes mensuales.** Basic $49 (4 sesiones de 90 min) y Frequent $89 (8 sesiones). Las sesiones son de autoservicio en el centro; si el socio quiere entrega (a su puerta o junto a una cancha, nunca dentro), paga la ida y vuelta de su zona en cada sesión, cobrada al momento a la tarjeta del paquete (si la tarjeta no pasa, la sesión se libera). Las sesiones no usadas no pasan al mes siguiente (se puede activar en Settings). El socio cancela desde *My bookings* y el paquete sigue activo hasta el fin del mes pagado.
- **Lluvia y créditos.** Si llueve el día de inicio, el cliente entra en *My bookings* antes de su hora y pulsa **Rained out?**: reprograma gratis o recibe un crédito del 100% de lo pagado, válido 6 meses (configurable). En Admin → **Rain day** declaras un día de lluvia y se avisa por email/SMS a todos los que empiezan ese día (pueden elegir aunque ya pasó la hora). El crédito se descuenta solo en la siguiente reserva con el mismo email o teléfono (dejando el cobro mínimo de $1 para guardar la tarjeta). Si esa reserva se abandona o se cancela, el crédito vuelve según la misma regla del reembolso. Desde la ficha de un cliente puedes dar un crédito manual; la reserva también tiene un botón **Rain credit** para hacerlo tú. En temporada baja se muestra el aviso "Off-season prices — if it rains on your day, reschedule free".
- **Spring Pass** (desactivado por defecto, Admin → Settings): 3 fines de semana por $199 para usar entre abril y junio, máximo 20 pases. Se paga una vez (la tarjeta queda guardada para los depósitos) y el cliente reserva cada fin de semana desde *My bookings*. Con el interruptor apagado no aparece en ninguna parte.
- **Solo alquiler.** RallyDrop solo alquila la máquina: no hay clases, sesiones de grupo ni coach humano. El coach es el de IA de la Aura S (sección "Your AI coach, included").
- **Pickleball.** `Settings → Pickleball unlocked` (activado). Si lo apagas, la palabra "pickleball" desaparece del sitio (fichas, footer, FAQ). Los textos legales ya aceptados no cambian; publica una versión nueva si quieres quitarlo también de ahí.
- **Métricas.** El dashboard muestra la ocupación por máquina (días alquilados ÷ días disponibles del mes, sin contar días bloqueados) y los ingresos del mes por producto. En la ficha de cada máquina, con el costo de compra, ves cuánto has recuperado (**Payback**).
- **Guía rápida.** `/guide` (pública, enlazada desde el email de confirmación y el portal; también en PDF: `public/guides/rallydrop-aura-s-quick-start.pdf`). Si cambias el texto de la guía, vuelve a exportar el PDF imprimiendo esa página (Guardar como PDF).
- **Hora de BC.** Todo el sitio funciona en hora de Victoria: horarios, calendario, emails y admin se calculan en el servidor.
  - Desde el 1 de noviembre de 2026 BC queda en UTC-7 fijo, sin más cambios de hora.
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

**Smoke test (Playwright)** contra un build de producción:

```bash
npm run build && npm run test:e2e   # arranca `next start` en :3200
```

Carga todas las páginas públicas, la 404, valida el paso de datos de la reserva y marca un alquiler como "Returned – OK" en el admin (comprueba que el depósito queda liberado). Con claves de Stripe test también comprueba que **Pagar** sigue desactivado sin las dos casillas; con `stripe listen --forward-to localhost:3200/api/stripe/webhook` y `E2E_STRIPE=1` completa un alquiler de un día con la tarjeta `4242 4242 4242 4242`.

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
   - `NEXT_PUBLIC_SITE_URL`: tu dominio (p. ej. `https://rallydrop.ca`). Se usa para las URL canónicas, el sitemap, `robots.txt` y los enlaces de los emails. Sin ella se usa el dominio de Vercel.
   - `AUTH_SECRET`, `PORTAL_SECRET` y `CRON_SECRET`: secretos aleatorios.
   - Las claves de Stripe, Resend y, opcionalmente, Twilio.
3. *Build command*: `prisma migrate deploy && npm run build`. Para aplicar migraciones a mano en su lugar, ejecuta `npm run db:deploy`.
4. Ejecuta una vez `npm run db:seed` contra la base de producción, con `SEED_ADMIN_*` propios.
5. En Stripe (modo live, cuando toque), crea el endpoint `https://TU-DOMINIO/api/stripe/webhook` con los eventos de arriba.
6. Añade un **Blob store** en Vercel para las fotos de check-in/out. Crea `BLOB_READ_WRITE_TOKEN`.
7. **Cron** (GitHub Actions, gratis): [`.github/workflows/daily-jobs.yml`](.github/workflows/daily-jobs.yml) llama `GET /api/cron/all` **cada hora** (a los :07). Hace cuatro cosas:
   - **Depósitos**: coloca cada retención 24 h antes del inicio y avisa de las que vencen antes de la devolución.
   - **Recordatorios**: envía el aviso de las reservas de mañana (solo de 7 AM a 9 PM).
   - **Limpieza**: libera las reservas temporales sin pagar.
   - **Reseñas**: 24 h después de marcar un alquiler como "Returned – OK", pide una reseña por email (una vez, de día). El cliente elige estrellas y escribe un texto en `/review/…`; la reseña queda **oculta** hasta que la publiques en Admin → Reviews.

   Configúralo en GitHub → *Settings → Secrets and variables → Actions* con dos secretos:
   - `SITE_URL`: por ejemplo `https://rallydrop.ca`.
   - `CRON_SECRET`: el mismo valor que en Vercel.

   Mientras falten los secretos, el workflow termina con un aviso (no falla); mientras no haya base de datos, el endpoint responde "skipped".

   Para probarlo: pestaña *Actions → Scheduled jobs → Run workflow*.

## Pendiente de configurar antes de lanzar

- [ ] **Cron horario**: el workflow ahora corre cada hora; revisa que los secretos `SITE_URL` y `CRON_SECRET` estén en GitHub.
- [ ] **Datos reales de contacto** (Admin → Settings → Business details): teléfono, email, dominio, dirección del punto de recogida e Instagram. Mientras estén vacíos, el sitio simplemente no los muestra. El **formulario de /contact** envía al email de contacto de Settings (o a `ADMIN_ALERT_EMAIL` si falta); sin ninguno de los dos muestra un aviso en vez de enviar.
- [ ] **Fotos y vídeos reales**: pon los archivos en `public/photos/` y sus rutas en [`src/config/photos.ts`](src/config/photos.ts) (hero del home, máquina en la cancha y cada paso de `/guide`). Mientras estén vacíos, el home muestra la ilustración y la guía muestra "Photo/Video coming soon". Si cambias el texto de la guía, vuelve a exportar el PDF.
- [ ] **Pickleball**: `pickleballEnabled` (Settings) está activado; si la máquina no lo hará, desactívalo y desaparece de todo el sitio.
- [ ] **Revisión legal**: los términos y el waiver son borradores (Admin → Terms & waiver, marcados DRAFT solo en el admin). Un abogado de BC debe revisarlos; publica la versión revisada y pulsa *Mark lawyer-reviewed*.
- [ ] **Seguro de responsabilidad civil**: mientras no esté en Settings, el dashboard muestra "No liability insurance on file".
- [ ] **Licencia municipal** (business licence) en Settings.
- [ ] **Impuestos**: cuando te registres para GST/PST, enciéndelos y guarda los números (confírmalo con tu contador).
- [ ] **Claves reales**: Stripe live (y su webhook), Resend con el dominio verificado (`EMAIL_FROM`), `ADMIN_ALERT_EMAIL`, Twilio si quieres SMS.
- [ ] **Base de datos de producción** (Neon) y `npm run db:seed`.
- [ ] **Foto de la Aura S**: confirma que tienes permiso de PONGBOT para usarla.
- [ ] **Contraseña del admin**: cambia la del seed. Para magic link del admin hace falta `RESEND_API_KEY`.
- [ ] **Stripe Customer Portal** activado para los paquetes.

## Notas

- **Admin en inglés.** Los textos del admin están en el código; los del sitio público están en `messages/en.json`.
- **Componentes UI.** Los componentes de `src/components/ui` siguen el estilo de shadcn/ui. `components.json` está listo para `npx shadcn add …`.
- **Mapas y geocodificación (OpenStreetMap, gratis).**
  - **Direcciones**: las de los clientes y las canchas se ubican con Nominatim. Si falla, una dirección con código postal del centro (FSA en `brand.ts` → `zone1Fsas`) cuenta como zona 1; si no, se le pide al cliente revisar la dirección o elegir una cancha.
  - **Canchas en el admin**: Admin → Settings → Courts. "Find on map" ubica la dirección; después haces clic en el mapa o arrastras el pin.
  - **Mapa público**: `/how-it-works#zone` muestra los anillos de las zonas de entrega y las canchas.
  - **Tiles**: los de `tile.openstreetmap.org` están bien para tráfico bajo. Si el sitio crece, cambia la URL en `src/components/maps/leaflet-map.tsx` por un proveedor como MapTiler o Stadia.
