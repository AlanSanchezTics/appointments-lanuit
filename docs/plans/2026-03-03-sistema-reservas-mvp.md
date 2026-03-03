# Sistema de Reservas MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir un MVP funcional del portal de citas que permita reservar y cancelar citas dentro del mes actual, con MySQL como fuente de verdad, sincronizacion espejo con Google Calendar y redireccion a WhatsApp.

**Architecture:** El sistema se implementa en Next.js App Router con reglas de negocio aisladas en `lib/`, persistencia en MySQL via Prisma y control de concurrencia en transacciones SQL. La UI mobile-first consume Route Handlers propios; Google Calendar se ejecuta solo despues del commit y nunca participa en la validacion de disponibilidad.

**Tech Stack:** Next.js, React, Tailwind CSS, Prisma ORM, MySQL, Docker Compose, Vitest, Testing Library, Playwright

---

## Supuestos de arranque

- El repositorio aun no contiene codigo de aplicacion; este plan crea la base completa.
- Se usara `npm` como package manager para reducir decisiones iniciales.
- La zona horaria del sistema debe fijarse a `America/Mexico_City` en backend y utilidades compartidas.
- La ruta publica principal sera `/citas/[month]` donde `month` usa formato `YYYY-MM`.

## Orden recomendado

1. Bootstrap del proyecto y entorno local
2. Modelo de datos y migraciones
3. Utilidades de fechas, validacion y disponibilidad
4. API de reserva
5. API de cancelacion
6. Integracion Google Calendar y WhatsApp
7. UI mobile-first
8. End-to-end, endurecimiento y documentacion

### Task 1: Bootstrap del proyecto Next.js y tooling base

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `next.config.ts`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `README.md`
- Test: `app/page.tsx`

**Step 1: Crear la app base**

Run: `npm create next-app@latest . --ts --tailwind --eslint --app --use-npm`
Expected: Estructura base de Next.js generada sin errores.

**Step 2: Configurar Docker y variables**

```yaml
services:
  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: appointments
      MYSQL_ROOT_PASSWORD: root
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

**Step 3: Preparar herramientas de test**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

**Step 4: Verificar arranque local**

Run: `npm run lint`
Expected: PASS sin errores de configuracion.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap next app and local tooling"
```

### Task 2: Modelar la base de datos y acceso Prisma

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/0001_init/migration.sql`
- Create: `lib/db/prisma.ts`
- Create: `lib/db/appointments.ts`
- Create: `tests/lib/db/appointments.test.ts`

**Step 1: Escribir el test del repositorio**

```ts
import { describe, expect, it } from "vitest";
import { hasActiveFutureAppointment } from "@/lib/db/appointments";

describe("hasActiveFutureAppointment", () => {
  it("returns false when there is no confirmed future appointment", async () => {
    const result = await hasActiveFutureAppointment("5512345678", new Date("2026-03-03T10:00:00-06:00"));
    expect(result).toBe(false);
  });
});
```

**Step 2: Definir schema Prisma**

```prisma
model Appointment {
  id            Int               @id @default(autoincrement())
  name          String            @db.VarChar(100)
  phone         String            @db.VarChar(10)
  date          DateTime          @db.Date
  timeSlot      DateTime          @map("time_slot") @db.Time(0)
  status        AppointmentStatus @default(CONFIRMED)
  googleEventId String?           @map("google_event_id") @db.VarChar(255)
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  @@unique([date, timeSlot])
  @@index([phone, status])
  @@index([date])
  @@map("appointments")
}

enum AppointmentStatus {
  CONFIRMED
  CANCELLED
  SYNC_FAILED
}
```

**Step 3: Implementar cliente Prisma singleton**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Ejecutar tests del repositorio**

Run: `npm run test -- tests/lib/db/appointments.test.ts`
Expected: FAIL primero por funciones faltantes; PASS despues de implementar el repositorio minimo.

**Step 5: Commit**

```bash
git add prisma lib/db tests/lib/db
git commit -m "feat: add appointments schema and prisma access layer"
```

### Task 3: Implementar utilidades de fecha, timezone y validacion

**Files:**
- Create: `lib/constants/slots.ts`
- Create: `lib/datetime/mexico-city.ts`
- Create: `lib/validation/appointment.ts`
- Create: `lib/validation/cancel.ts`
- Create: `tests/lib/validation/appointment.test.ts`
- Create: `tests/lib/datetime/mexico-city.test.ts`

**Step 1: Escribir los tests de reglas base**

```ts
expect(isValidPhone("5512345678")).toBe(true);
expect(isValidPhone("55 1234 5678")).toBe(false);
expect(isBookingMonthAllowed("2026-03", new Date("2026-03-03T09:00:00-06:00"))).toBe(true);
expect(isBookingMonthAllowed("2026-04", new Date("2026-03-03T09:00:00-06:00"))).toBe(false);
```

**Step 2: Declarar horarios base y reglas**

```ts
export const BASE_TIME_SLOTS = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"] as const;
export const APPOINTMENT_GAP_HOURS = 4;
export const GOOGLE_EVENT_DURATION_HOURS = 3;
export const REQUIRED_TIMEZONE = "America/Mexico_City";
```

**Step 3: Implementar validaciones puras**

```ts
export function isValidPhone(phone: string) {
  return /^[0-9]{10}$/.test(phone);
}

export function isValidName(name: string) {
  return name.trim().length >= 3;
}
```

**Step 4: Verificar tests**

Run: `npm run test -- tests/lib/validation/appointment.test.ts tests/lib/datetime/mexico-city.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/constants lib/datetime lib/validation tests/lib
git commit -m "feat: add timezone and validation rules"
```

### Task 4: Construir el motor de disponibilidad

**Files:**
- Create: `lib/availability/rules.ts`
- Create: `lib/availability/service.ts`
- Create: `app/api/availability/[month]/route.ts`
- Create: `tests/lib/availability/service.test.ts`
- Test: `tests/app/api/availability-month.test.ts`

**Step 1: Escribir test de disponibilidad**

```ts
expect(isWeekdayBookingDate(new Date("2026-03-04T12:00:00-06:00"))).toBe(true);
expect(isWeekdayBookingDate(new Date("2026-03-07T12:00:00-06:00"))).toBe(false);
expect(hasMinimumGap("09:00", ["10:00"])).toBe(false);
```

**Step 2: Implementar reglas de negocio puras**

```ts
export function hasMinimumGap(candidateHour: number, existingHours: number[]) {
  return existingHours.every((hour) => Math.abs(candidateHour - hour) >= 4);
}
```

**Step 3: Implementar servicio que calcula dias y slots**

```ts
export async function getMonthAvailability(month: string) {
  // valida mes actual, consulta citas CONFIRMED/SYNC_FAILED del mes,
  // elimina dias pasados y slots que violen gap minimo o ya esten ocupados
}
```

**Step 4: Exponer endpoint**

Run: `npm run test -- tests/lib/availability/service.test.ts tests/app/api/availability-month.test.ts`
Expected: PASS y respuesta JSON solo para el mes actual.

**Step 5: Commit**

```bash
git add lib/availability app/api/availability tests
git commit -m "feat: add availability engine and endpoint"
```

### Task 5: Implementar API de reserva atomica

**Files:**
- Create: `app/api/reservar/route.ts`
- Create: `lib/appointments/book-appointment.ts`
- Create: `tests/lib/appointments/book-appointment.test.ts`
- Create: `tests/app/api/reservar-route.test.ts`

**Step 1: Escribir test de reserva exitosa**

```ts
await expect(bookAppointment({
  name: "Ana Lopez",
  phone: "5512345678",
  date: "2026-03-04",
  timeSlot: "09:00"
})).resolves.toMatchObject({ status: "CONFIRMED" });
```

**Step 2: Escribir test de carrera por slot**

```ts
const results = await Promise.allSettled([
  bookAppointment(payload),
  bookAppointment(payload)
]);
expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
```

**Step 3: Implementar flujo transaccional**

```ts
await prisma.$transaction(async (tx) => {
  // 1. validar mes actual
  // 2. bloquear registros relevantes con SELECT ... FOR UPDATE
  // 3. validar telefono y disponibilidad real
  // 4. insertar cita CONFIRMED
});
```

**Step 4: Mapear errores HTTP**

Run: `npm run test -- tests/lib/appointments/book-appointment.test.ts tests/app/api/reservar-route.test.ts`
Expected: PASS con `409` para conflicto y `400` para payload invalido.

**Step 5: Commit**

```bash
git add app/api/reservar lib/appointments tests
git commit -m "feat: add atomic booking endpoint"
```

### Task 6: Implementar cancelacion y liberacion del horario

**Files:**
- Create: `app/api/cancelar/route.ts`
- Create: `lib/appointments/cancel-appointment.ts`
- Create: `tests/lib/appointments/cancel-appointment.test.ts`
- Create: `tests/app/api/cancelar-route.test.ts`

**Step 1: Escribir test de busqueda y cancelacion**

```ts
await expect(findActiveAppointmentByPhone("5512345678")).resolves.toMatchObject({
  status: "CONFIRMED"
});
await expect(cancelAppointment({ phone: "5512345678" })).resolves.toMatchObject({
  status: "CANCELLED"
});
```

**Step 2: Bloquear cancelacion de citas pasadas**

```ts
await expect(cancelAppointment({ phone: "5512345678" })).rejects.toThrow("PAST_APPOINTMENT");
```

**Step 3: Implementar actualizacion persistente**

```ts
await prisma.appointment.update({
  where: { id },
  data: { status: "CANCELLED", googleEventId: null }
});
```

**Step 4: Ejecutar tests**

Run: `npm run test -- tests/lib/appointments/cancel-appointment.test.ts tests/app/api/cancelar-route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/cancelar lib/appointments tests
git commit -m "feat: add cancellation flow"
```

### Task 7: Integrar Google Calendar y redireccion a WhatsApp

**Files:**
- Create: `lib/calendar/google.ts`
- Create: `lib/calendar/sync-appointment.ts`
- Create: `lib/whatsapp/message.ts`
- Create: `tests/lib/calendar/sync-appointment.test.ts`
- Create: `tests/lib/whatsapp/message.test.ts`

**Step 1: Escribir tests de mensaje y sync**

```ts
expect(buildWhatsappUrl({
  name: "Ana",
  dateLabel: "4 de marzo de 2026",
  timeLabel: "09:00"
})).toContain(encodeURIComponent("Hola Pau, soy Ana."));
```

**Step 2: Implementar cliente de Calendar**

```ts
export async function createCalendarEvent(input: CalendarEventInput) {
  // usar timezone America/Mexico_City y duracion fija de 3 horas
}
```

**Step 3: Persistir estado SYNC_FAILED**

```ts
catch (error) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "SYNC_FAILED" }
  });
}
```

**Step 4: Ejecutar tests**

Run: `npm run test -- tests/lib/calendar/sync-appointment.test.ts tests/lib/whatsapp/message.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/calendar lib/whatsapp tests/lib
git commit -m "feat: add calendar sync and whatsapp redirect"
```

### Task 8: Implementar UI mobile-first de reserva y cancelacion

**Files:**
- Create: `app/citas/[month]/page.tsx`
- Create: `app/cancelar/page.tsx`
- Create: `components/booking/month-view.tsx`
- Create: `components/booking/day-selector.tsx`
- Create: `components/booking/time-slot-selector.tsx`
- Create: `components/booking/booking-form.tsx`
- Create: `components/cancel/cancel-form.tsx`
- Create: `components/ui/button.tsx`
- Create: `tests/app/citas-month-page.test.tsx`
- Create: `tests/app/cancelar-page.test.tsx`

**Step 1: Escribir test de render principal**

```tsx
render(<BookingForm availableSlots={["09:00", "13:00"]} />);
expect(screen.getByText("Selecciona tu horario")).toBeInTheDocument();
```

**Step 2: Implementar flujo de seleccion**

```tsx
// dia -> horario -> datos -> submit
// toda regla visual depende de data de backend, no de logica duplicada
```

**Step 3: Manejar estados de error y exito**

```tsx
// mostrar conflictos de disponibilidad, telefono invalido y cita cancelada
```

**Step 4: Ejecutar pruebas UI**

Run: `npm run test -- tests/app/citas-month-page.test.tsx tests/app/cancelar-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/citas app/cancelar components tests/app
git commit -m "feat: add booking and cancellation interfaces"
```

### Task 9: End-to-end, endurecimiento y documentacion operativa

**Files:**
- Create: `tests/e2e/booking.spec.ts`
- Create: `tests/e2e/cancellation.spec.ts`
- Create: `docs/architecture.md`
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Escribir escenario E2E de reserva**

```ts
test("user books an available slot and is redirected to WhatsApp", async ({ page }) => {
  await page.goto("/citas/2026-03");
  await page.getByText("4").click();
  await page.getByRole("button", { name: "09:00" }).click();
  await page.getByLabel("Nombre").fill("Ana Lopez");
  await page.getByLabel("Telefono").fill("5512345678");
  await page.getByRole("button", { name: "Confirmar cita" }).click();
});
```

**Step 2: Escribir escenario E2E de cancelacion**

```ts
test("user cancels a future appointment", async ({ page }) => {
  await page.goto("/cancelar");
  await page.getByLabel("Telefono").fill("5512345678");
  await page.getByRole("button", { name: "Buscar cita" }).click();
  await page.getByRole("button", { name: "Cancelar cita" }).click();
});
```

**Step 3: Documentar setup y reglas de negocio**

```md
- como levantar Docker
- como correr migraciones
- variables de Google Calendar
- decisiones de concurrencia
- matriz de errores HTTP
```

**Step 4: Ejecutar suite completa**

Run: `npm run test && npm run test:e2e`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e docs README.md .env.example
git commit -m "test: add e2e coverage and operational docs"
```

## Riesgos y controles

- Concurrencia: Prisma no expone `SELECT ... FOR UPDATE` de forma ergonomica; si hace falta, usar `tx.$queryRaw` en el servicio de reserva.
- Timezone: nunca construir fechas con timezone local implicita del runtime; centralizar helpers en `lib/datetime/mexico-city.ts`.
- Google Calendar: la reserva debe quedar confirmada aunque falle el espejo; por eso existe `SYNC_FAILED`.
- UI: no recalcular disponibilidad critica en cliente; el backend debe ser autoridad.

## Criterios de aceptacion del MVP

- Solo se puede reservar en `/citas/YYYY-MM` del mes actual.
- No se permiten citas el mismo dia ni en fin de semana.
- Un slot ocupado o con separacion menor a 4 horas no aparece disponible.
- Un telefono con cita futura activa no puede reservar otra.
- Dos reservas simultaneas para el mismo slot producen exactamente una cita `CONFIRMED`.
- Al fallar Google Calendar la cita persiste como `SYNC_FAILED`.
- La cancelacion de una cita futura cambia el estado a `CANCELLED` y libera el horario.
- La UI mobile-first permite reservar y cancelar sin depender de Google Calendar para validar.

## Planes derivados recomendados

- Plan 2: panel administrativo ligero para ver citas del mes y reintentar sync fallido.
- Plan 3: observabilidad minima con logs estructurados y alertas de `SYNC_FAILED`.
- Plan 4: hardening de seguridad con rate limiting en reserva y cancelacion.

