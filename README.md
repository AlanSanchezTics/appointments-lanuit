# Appointments La Nuit

Portal de citas mobile-first para una manicurista independiente.

## Stack

- Next.js App Router
- Tailwind CSS
- Prisma ORM
- MySQL en Docker
- Google Calendar como espejo

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Levanta MySQL con `docker compose up -d`.
3. Instala dependencias con `npm install`.
4. Genera Prisma con `npm run prisma:generate`.
5. Aplica migraciones con `npm run prisma:migrate`.
6. Arranca el proyecto con `npm run dev`.
7. Para pruebas de integracion con MySQL real usa `npm run test:integration`.

## Google Calendar real

1. Crea una Service Account en Google Cloud con acceso a Calendar API.
2. Comparte el calendario destino con el email de la cuenta de servicio.
3. Completa `.env` con `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` y `GOOGLE_CALENDAR_ID`.
4. Verifica la conexion real con `npm run calendar:smoke`.

El smoke test crea un evento temporal en la fecha y hora indicadas por `GOOGLE_CALENDAR_SMOKE_DATE` y `GOOGLE_CALENDAR_SMOKE_TIME`, y luego lo elimina.

## Reglas criticas

- Solo se puede reservar dentro de meses habilitados.
- No se permiten citas el mismo dia.
- Solo lunes a viernes.
- Separacion minima de 4 horas entre inicios.
- Un telefono solo puede tener una cita futura activa.
- MySQL es la fuente de verdad.
- Google Calendar se sincroniza despues del commit.
