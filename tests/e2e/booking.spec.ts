import { expect, test, type Page } from "@playwright/test";

import { formatTimeSlotLabel } from "../../lib/datetime/mexico-city";
import { prisma } from "../../lib/db/prisma";

// Bloque de reglas (T062, quickstart S-09). Solo contra appointments_test con ENABLE_E2E_DB=1.
// Ejecutar con --workers=1 y nunca en paralelo: este archivo y tests/e2e/admin-month-availability.spec.ts usan el mes 2026-12.
// En paralelo, ambos pueden pasar la guardia a la vez y escribir en el mismo mes.
//
// Propiedad de datos: assertMonthEmpty() exige que 2026-12 no tenga fila activeMonth, reglas, excepciones, bloqueos de reserva,
// citas ni bloqueos manuales. Si no se cumple, lanza antes de escribir y guardPassed queda en false: beforeAll, afterEach y afterAll
// no borran ni escriben nada. Tras pasar la guardia, el bloque crea su fila activeMonth y su regla, y borra solo esas filas,
// los locks del mes y el cliente y la cita de su propia prueba de reserva (teléfono único generado por la prueba).
// Las pruebas heredadas de abajo (mes actual) no usan el bloque de reglas.
//
// Fechas fijas: el 14 y el 15 de diciembre de 2026 dejan de ser futuras a mitad de mes. La ventana válida es hasta 2026-12-13.
// Al cambiarla, actualizar RULES_MONTH, MONTH_START, NEXT_MONTH_START, RULE_START, RULE_END y las fechas escritas en las pruebas.

// Solo contra appointments_test con ENABLE_E2E_DB=1.
const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_E2E_DB === "1";
const rulesSuite = hasDatabase ? test.describe : test.describe.skip;

// Fechas fijas en el futuro (hoy 2026-10-31). Diciembre 2026 con la regla B de S-04: días 14-23, todos los días.
const RULES_MONTH = "2026-12";
const MONTH_START = new Date("2026-12-01T00:00:00.000Z");
const NEXT_MONTH_START = new Date("2027-01-01T00:00:00.000Z");
const RULE_START = new Date("2026-12-14T00:00:00.000Z");
const RULE_END = new Date("2026-12-23T00:00:00.000Z");
const RULE_TIMES = ["07:30", "11:00", "14:30", "18:00"];

// La primera llamada a una ruta compila el dev server (1.5-5 s); el timeout por defecto de 5 s no basta.
const FIRST_HIT_TIMEOUT = 15000;

// Propiedad del bloque de reglas: true solo si assertMonthEmpty() pasó; las demás variables solo guardan filas creadas aquí.
let guardPassed = false;
let ownMonthId: number | null = null;
let ownRuleId: number | null = null;
// Teléfono de la cita creada por la prueba de reserva; se limpia en afterAll.
let bookingPhone: string | null = null;

function assertTestDatabase() {
  const pathname = new URL(process.env.DATABASE_URL ?? "").pathname;

  if (pathname !== "/appointments_test") {
    throw new Error("Refusing to run: DATABASE_URL does not target appointments_test.");
  }
}

function assertFutureMonth() {
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  if (RULES_MONTH < currentMonth) {
    throw new Error(`RULES_MONTH ${RULES_MONTH} is not in the future; update the fixed dates in this spec.`);
  }
}

// Guardia: el mes debe estar vacío y sin fila activeMonth. Solo lee; lanza antes de cualquier escritura.
async function assertMonthEmpty() {
  const dateRange = { gte: MONTH_START, lt: NEXT_MONTH_START };
  const found = {
    activeMonthRow: await prisma.activeMonth.count({ where: { month: RULES_MONTH } }),
    rules: await prisma.availabilityRule.count({ where: { activeMonth: { month: RULES_MONTH } } }),
    exceptions: await prisma.availabilityException.count({ where: { activeMonth: { month: RULES_MONTH } } }),
    reservationLocks: await prisma.reservationLock.count({ where: { date: dateRange } }),
    appointments: await prisma.appointment.count({ where: { date: dateRange } }),
    blockedSlots: await prisma.blockedSlot.count({ where: { date: dateRange } }),
  };
  const nonEmpty = Object.entries(found)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`);

  if (nonEmpty.length > 0) {
    throw new Error(
      `Refusing to run: ${RULES_MONTH} already has data this spec did not create (${nonEmpty.join(", ")}). Nothing was changed.`,
    );
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Elige día y horario en el paso de agenda y continúa. Llegar a identidad exige que el servidor conceda el bloqueo del horario.
async function selectSlotAndContinue(page: Page, options: { day: number; slot: string }) {
  await page.goto(`/booking?month=${RULES_MONTH}`);

  // El primer día con horarios viene preseleccionado: su nombre es "Día seleccionado ...", no "Seleccionar día ...".
  await page
    .getByRole("button", { name: new RegExp(`^(Seleccionar d.a|D.a seleccionado) \\S+ ${options.day}$`) })
    .click();
  const slotLabel = formatTimeSlotLabel(options.slot, "es");
  await page
    .getByRole("button", { name: new RegExp(`Seleccionar horario ${escapeRegExp(slotLabel)}`) })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();

  await expect(page.locator("#booking-phone")).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
}

rulesSuite("public booking with availability rules", () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeAll(async () => {
    assertTestDatabase();
    assertFutureMonth();
    await assertMonthEmpty();
    guardPassed = true;

    const month = await prisma.activeMonth.create({ data: { month: RULES_MONTH, status: "ACTIVE" } });
    ownMonthId = month.id;

    const rule = await prisma.availabilityRule.create({
      data: {
        activeMonthId: month.id,
        startDate: RULE_START,
        endDate: RULE_END,
        minGapMinutes: 0,
        preserveCapacity: false,
        maxPerDay: 4,
        weekdays: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday })) },
        times: {
          create: RULE_TIMES.map((time) => ({ timeSlot: new Date(`1970-01-01T${time}:00.000Z`) })),
        },
      },
    });
    ownRuleId = rule.id;
    await prisma.activeMonth.update({ where: { id: month.id }, data: { availabilityVersion: { increment: 1 } } });
  });

  test.afterEach(async () => {
    if (!guardPassed) {
      return;
    }

    // Cada prueba empieza sin bloqueos: un lock de la anterior no debe rechazar el mismo horario.
    await prisma.reservationLock.deleteMany({ where: { date: { gte: MONTH_START, lt: NEXT_MONTH_START } } });
  });

  test.afterAll(async () => {
    try {
      // Sin guardia aprobada no se borra ni se escribe nada: el mes pertenece a otro uso.
      if (!guardPassed) {
        return;
      }

      // Cliente y cita de la prueba de reserva (orden: logs, citas, cliente; las FK son restrictivas).
      const phone = bookingPhone;
      if (phone) {
        const clients = await prisma.client.findMany({ where: { phone }, select: { id: true } });
        const clientIds = clients.map((client) => client.id);
        await prisma.appointmentLog.deleteMany({ where: { clientId: { in: clientIds } } });
        await prisma.appointment.deleteMany({ where: { clientId: { in: clientIds } } });
        await prisma.client.deleteMany({ where: { phone } });
      }

      // Locks temporales del mes (el guardia comprobó que no había ninguno al empezar).
      await prisma.reservationLock.deleteMany({ where: { date: { gte: MONTH_START, lt: NEXT_MONTH_START } } });
      if (ownRuleId !== null) {
        await prisma.availabilityRule.deleteMany({ where: { id: ownRuleId } });
      }
      if (ownMonthId !== null) {
        await prisma.activeMonth.deleteMany({ where: { id: ownMonthId, month: RULES_MONTH } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("shows the resolver times 07:30 and 14:30 and accepts them in the schedule step", async ({ page, request }) => {
    const response = await request.get(`/api/availability/${RULES_MONTH}`);
    expect(response.ok()).toBeTruthy();

    const availability = (await response.json()) as { days: Array<{ date: string; slots: string[] }> };
    const monday = availability.days.find((day) => day.date === "2026-12-14");
    expect(monday?.slots).toEqual(RULE_TIMES);
    // Días 1-13 sin regla: no aparecen con horarios.
    expect(availability.days.some((day) => day.date < "2026-12-14")).toBe(false);

    // Horario 07:30 el 14: el servidor concede el bloqueo y el asistente avanza a identidad.
    await selectSlotAndContinue(page, { day: 14, slot: "07:30" });

    // Horario 14:30 el 15: se muestra en la agenda del día y se acepta del mismo modo.
    await selectSlotAndContinue(page, { day: 15, slot: "14:30" });
  });

  test("books 07:30 on the 14th as a new client through identity and confirm (S-09)", async ({ page }) => {
    const phone = getUniquePhone();
    const name = "Cliente Regla";
    bookingPhone = phone;

    await selectSlotAndContinue(page, { day: 14, slot: "07:30" });

    // Cliente nueva: el primer "Siguiente" comprueba el teléfono y muestra el campo de nombre; sigue en identidad con el lock vigente.
    await page.locator("#booking-phone").fill(phone);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.locator("#booking-name")).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });

    await page.locator("#booking-name").fill(name);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();

    // Confirmación de cliente nueva: el CTA es "Siguiente" (no "Confirmar cita") y aparece "Editar información".
    await expect(page.getByRole("button", { name: "Editar información", exact: true })).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();

    // Cliente no fiel: la cita queda PENDING, sin redirección automática a WhatsApp y con el depósito.
    // Esta espera cubre la primera compilación de /api/reservar/confirm (1.5-5 s en dev).
    await expect(page.getByText(/Ya casi estamos/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Enviar comprobante" })).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    expect(page.url()).not.toContain("wa.me");

    const client = await prisma.client.findUnique({ where: { phone }, select: { name: true, isLoyal: true } });
    expect(client).toMatchObject({ name, isLoyal: false });

    const appointments = await prisma.appointment.findMany({
      where: { client: { phone } },
      select: { date: true, timeSlot: true, status: true },
    });
    expect(appointments).toHaveLength(1);
    expect(appointments[0].date.toISOString().slice(0, 10)).toBe("2026-12-14");
    expect(appointments[0].timeSlot.toISOString().slice(11, 16)).toBe("07:30");
    expect(appointments[0].status).toBe("PENDING");
  });

  test("rejects 07:30 on the closed 5th with SLOT_NOT_AVAILABLE and creates nothing (S-09 3-4)", async ({ request }) => {
    const closedDay = new Date("2026-12-05T00:00:00.000Z");
    const body = { phone: "5599000011", date: "2026-12-05", timeSlot: "07:30" };

    // Reservar exige lock previo: la primera llamada pública (lock) es la que rechaza el horario.
    const lock = await request.post("/api/reservar/lock", { data: body });
    expect(lock.status()).toBe(409);
    await expect(lock.json()).resolves.toMatchObject({ error: "SLOT_NOT_AVAILABLE" });

    // La verificación de cliente usa el mismo núcleo y también rechaza el horario.
    const check = await request.post("/api/reservar/client-check-lock", { data: body });
    expect(check.status()).toBe(409);
    await expect(check.json()).resolves.toMatchObject({ error: "SLOT_NOT_AVAILABLE" });

    expect(await prisma.reservationLock.count({ where: { date: closedDay } })).toBe(0);
    expect(await prisma.appointment.count({ where: { date: closedDay } })).toBe(0);
  });
});

function getActiveMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function getUniquePhone() {
  const suffix = String(Date.now()).slice(-8);
  return `55${suffix}`;
}

test("home exposes booking entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('a[href^="/citas/"][href$="/booking"]').first()).toBeVisible();
});

test("legacy booking endpoint is deprecated", async ({ request }) => {
  const month = getActiveMonth();
  const availabilityResponse = await request.get(`/api/availability/${month}`);
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };
  const day = availability.days[0];
  expect(day).toBeTruthy();

  const bookingResponse = await request.post("/api/reservar", {
    data: {
      name: "E2E Booking",
      phone: "5511111120",
      date: day.date,
      timeSlot: day.slots[0],
    },
  });

  expect(bookingResponse.status()).toBe(410);
  await expect(bookingResponse.json()).resolves.toMatchObject({
    error: "ENDPOINT_DEPRECATED_USE_CHECK_LOCK_CONFIRM",
  });
});

test("booking flow redirects to WhatsApp automatically from success with manual fallback", async ({ page, request }) => {
  const month = getActiveMonth();
  const availabilityResponse = await request.get(`/api/availability/${month}`);
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };

  expect(availability.days.length).toBeGreaterThan(0);

  await page.route("https://wa.me/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>ok</body></html>",
    });
  });

  await page.goto(`/citas/${month}`);
  await expect(page).toHaveURL(new RegExp(`/citas/${month}/booking$`));
  await expect(page.getByRole("heading", { name: /Agendar cita/i })).toBeVisible();
  await page.locator("#booking-phone").fill(getUniquePhone());
  await page.getByRole("button", { name: /Siguiente/i }).click();

  const confirmHeading = page.getByText(/Confirmar Detalles/i);
  if (!(await confirmHeading.isVisible())) {
    await expect(page.locator("#booking-name")).toBeVisible();
    await page.locator("#booking-name").fill("UI Wizard");
    await page.getByRole("button", { name: /Siguiente/i }).click();
  }

  await expect(confirmHeading).toBeVisible();
  await page.getByRole("button", { name: /Confirmar cita/i }).click();

  let autoRedirected = true;
  try {
    await page.waitForURL(/https:\/\/wa\.me\//, { timeout: 4000 });
  } catch {
    autoRedirected = false;
  }

  if (!autoRedirected) {
    const whatsappButton = page
      .getByRole("button", { name: /Enviar comprobante|WhatsApp/i })
      .first();
    await expect(whatsappButton).toBeVisible();
    await whatsappButton.click();
  }

  await expect(page).toHaveURL(/https:\/\/wa\.me\//);
});
