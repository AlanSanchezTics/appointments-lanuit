import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPasswordHash, verifyPasswordHash } from "../../lib/admin/auth/service";
import { prisma } from "../../lib/db/prisma";

// Solo corre contra la base de pruebas (appointments_test) y con ENABLE_E2E_DB=1. Ver informe de la ronda 3B y 3B-r2.
// Ejecutar con --workers=1 y nunca en paralelo: este spec y tests/e2e/booking.spec.ts usan el mes 2026-12.
// En paralelo, ambos pueden pasar la guardia a la vez y escribir en el mismo mes.
//
// Propiedad de datos: assertMonthEmpty() exige que 2026-12 no tenga fila activeMonth, reglas, excepciones,
// bloqueos de reserva, citas ni bloqueos manuales. Si no se cumple, lanza antes de escribir y guardPassed queda en false:
// beforeEach, afterAll y cualquier limpieza no borran ni escriben nada. Tras pasar la guardia, este spec crea la fila
// activeMonth y solo borra filas que creó (por id, o por su fila activeMonth).
//
// Fechas fijas: el 14 y el 15 de diciembre de 2026 dejan de ser futuras a mitad de mes. La ventana válida es hasta 2026-12-13.
// Al cambiarla, actualizar TARGET_MONTH, MONTH_START, NEXT_MONTH_START, APPOINTMENT_DATE, BLOCK_DATE y BLOCK_TIME (sin añadir lógica).

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_E2E_DB === "1";
const e2eSuite = hasDatabase ? test.describe : test.describe.skip;

const E2E_ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "e2e-admin";
const E2E_ADMIN_NAME = process.env.E2E_ADMIN_NAME ?? "E2E Admin";
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123";

// Fechas fijas: diciembre 2026 es futuro para el reloj de la prueba (hoy 2026-10-31). Ver assertFutureMonth.
const TARGET_MONTH = "2026-12";
const MONTH_START = new Date("2026-12-01T00:00:00.000Z");
const NEXT_MONTH_START = new Date("2027-01-01T00:00:00.000Z");
const APPOINTMENT_DATE = new Date("2026-12-14T00:00:00.000Z"); // lunes: cubierto por la regla por defecto (L-V)
const APPOINTMENT_TIME = "17:00";
const BLOCK_DATE = new Date("2026-12-15T00:00:00.000Z");
const BLOCK_TIME = new Date("2026-12-15T17:00:00.000Z");

const AFFECTED_DIALOG_TITLE = "Hay citas que quedarían fuera del horario";
const EDITOR_TITLE = "Disponibilidad del mes";

// La primera llamada a una ruta compila el dev server (1.5-5 s); el timeout por defecto de 5 s no basta.
const FIRST_HIT_TIMEOUT = 15000;

// Propiedad de este spec: true solo si assertMonthEmpty() pasó; ownMonthId solo si este spec creó la fila activeMonth.
let guardPassed = false;
let ownMonthId: number | null = null;

function readEnvValue(key: string) {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const line = envFile
      .split("\n")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${key}=`));

    if (!line) {
      return null;
    }

    const raw = line.slice(`${key}=`.length).trim();
    return raw.replace(/^['"]|['"]$/g, "");
  } catch {
    return null;
  }
}

function ensurePepperInProcessEnv() {
  if (typeof process.env.ADMIN_AUTH_PEPPER === "string") {
    return;
  }

  const pepperFromEnvFile = readEnvValue("ADMIN_AUTH_PEPPER");
  if (pepperFromEnvFile !== null) {
    process.env.ADMIN_AUTH_PEPPER = pepperFromEnvFile;
  }
}

// Salvaguarda: aborta si la URL no apunta a appointments_test. No imprime la URL ni credenciales.
function assertTestDatabase() {
  const pathname = new URL(process.env.DATABASE_URL ?? "").pathname;

  if (pathname !== "/appointments_test") {
    throw new Error("Refusing to run: DATABASE_URL does not target appointments_test.");
  }
}

function getCurrentMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

function assertFutureMonth() {
  if (TARGET_MONTH < getCurrentMonthKey()) {
    throw new Error(`TARGET_MONTH ${TARGET_MONTH} is not in the future; update the fixed dates in this spec.`);
  }
}

// Guardia: el mes debe estar vacío y sin fila activeMonth. Solo lee; lanza antes de cualquier escritura.
async function assertMonthEmpty() {
  const dateRange = { gte: MONTH_START, lt: NEXT_MONTH_START };
  const found = {
    activeMonthRow: await prisma.activeMonth.count({ where: { month: TARGET_MONTH } }),
    rules: await prisma.availabilityRule.count({ where: { activeMonth: { month: TARGET_MONTH } } }),
    exceptions: await prisma.availabilityException.count({ where: { activeMonth: { month: TARGET_MONTH } } }),
    reservationLocks: await prisma.reservationLock.count({ where: { date: dateRange } }),
    appointments: await prisma.appointment.count({ where: { date: dateRange } }),
    blockedSlots: await prisma.blockedSlot.count({ where: { date: dateRange } }),
  };
  const nonEmpty = Object.entries(found)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`);

  if (nonEmpty.length > 0) {
    throw new Error(
      `Refusing to run: ${TARGET_MONTH} already has data this spec did not create (${nonEmpty.join(", ")}). Nothing was changed.`,
    );
  }
}

async function ensureE2EAdminUser() {
  ensurePepperInProcessEnv();
  const existing = await prisma.adminUser.findUnique({
    where: { username: E2E_ADMIN_USERNAME },
    select: { name: true, status: true, passwordHash: true, passwordSalt: true },
  });
  // Si el usuario ya cumple (mismo nombre, activo, misma contraseña), no se reescribe: la fila queda intacta entre corridas.
  if (
    existing &&
    existing.name === E2E_ADMIN_NAME &&
    existing.status === "active" &&
    verifyPasswordHash({
      password: E2E_ADMIN_PASSWORD,
      passwordSalt: existing.passwordSalt,
      passwordHash: existing.passwordHash,
    })
  ) {
    return;
  }

  const { hash, salt } = createPasswordHash(E2E_ADMIN_PASSWORD);

  await prisma.adminUser.upsert({
    where: { username: E2E_ADMIN_USERNAME },
    update: { name: E2E_ADMIN_NAME, passwordHash: hash, passwordSalt: salt, status: "active" },
    create: {
      username: E2E_ADMIN_USERNAME,
      name: E2E_ADMIN_NAME,
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
    },
  });
}

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#admin-username").fill(E2E_ADMIN_USERNAME);
  await page.locator("#admin-password").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Iniciar sesi.n|Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: FIRST_HIT_TIMEOUT });
}

async function openAvailabilityEditor(page: Page) {
  await page.goto(`/admin/months/${TARGET_MONTH}`);
  await page.getByRole("button", { name: "Reglas", exact: true }).click();

  const editor = page.getByRole("dialog", { name: EDITOR_TITLE });
  await expect(editor).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
  await expect(editor.getByRole("button", { name: "Agregar regla", exact: true })).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });

  return editor;
}

// Regla nueva con los valores por defecto (L-V, 09:00 a 18:00 con 17:00 incluido).
async function addDefaultRule(editor: Locator) {
  await editor.getByRole("button", { name: "Agregar regla", exact: true }).click();
  await expect(editor.getByLabel("Desde").first()).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
}

async function readMonthState() {
  const month = await prisma.activeMonth.findUniqueOrThrow({
    where: { month: TARGET_MONTH },
    select: {
      availabilityVersion: true,
      _count: { select: { availabilityRules: true, availabilityExceptions: true } },
    },
  });

  return {
    version: month.availabilityVersion,
    rules: month._count.availabilityRules,
    exceptions: month._count.availabilityExceptions,
  };
}

async function readRuleTimes() {
  const rules = await prisma.availabilityRule.findMany({
    where: { activeMonth: { month: TARGET_MONTH } },
    include: { times: true },
  });

  return rules.map((rule) => rule.times.map((time) => time.timeSlot.toISOString().slice(11, 16)));
}

async function readAppointmentSnapshot(appointmentId: number) {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: { status: true, date: true, timeSlot: true, googleEventId: true },
  });

  return JSON.stringify(appointment);
}

// Solo con guardia aprobada y sobre la fila activeMonth creada por este spec: borra reglas/excepciones creadas por la UI.
async function resetOwnMonthAvailability() {
  if (!guardPassed || ownMonthId === null) {
    return;
  }

  await prisma.availabilityRule.deleteMany({ where: { activeMonthId: ownMonthId } });
  await prisma.availabilityException.deleteMany({ where: { activeMonthId: ownMonthId } });
  await prisma.activeMonth.update({
    where: { id: ownMonthId },
    data: { status: "ACTIVE", availabilityVersion: 0 },
  });
}

e2eSuite("admin month availability editor e2e", () => {
  let clientId = 0;
  let appointmentId = 0;
  let blockId = 0;

  test.describe.configure({ timeout: 60000 });

  test.beforeAll(async () => {
    assertTestDatabase();
    assertFutureMonth();
    await assertMonthEmpty();
    guardPassed = true;

    await ensureE2EAdminUser();

    const month = await prisma.activeMonth.create({ data: { month: TARGET_MONTH, status: "ACTIVE" } });
    ownMonthId = month.id;

    const phone = `55${Date.now().toString().slice(-8)}`;
    const maxClient = await prisma.client.aggregate({ _max: { clientNumber: true } });
    const client = await prisma.client.create({
      data: { clientNumber: (maxClient._max.clientNumber ?? 0) + 1, name: "E2E Availability Client", phone },
    });
    clientId = client.id;

    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        date: APPOINTMENT_DATE,
        timeSlot: new Date(`2026-12-14T${APPOINTMENT_TIME}:00.000Z`),
        status: "CONFIRMED",
        googleEventId: `e2e-availability-${Date.now()}`,
      },
    });
    appointmentId = appointment.id;

    // Bloqueo manual el martes 15 a las 17:00, dentro de la regla antes de editar. La edición que quita 17:00
    // no lo lista como afectado: los bloqueos manuales no aparecen en el diálogo (D40).
    const block = await prisma.blockedSlot.create({
      data: { date: BLOCK_DATE, timeSlot: BLOCK_TIME, reason: "OTRO" },
    });
    blockId = block.id;
  });

  test.beforeEach(async () => {
    await resetOwnMonthAvailability();
  });

  test.afterAll(async () => {
    try {
      // Sin guardia aprobada no se borra ni se escribe nada: el mes pertenece a otro uso.
      if (!guardPassed) {
        return;
      }

      if (appointmentId > 0) {
        await prisma.appointmentLog.deleteMany({ where: { appointmentId } });
        await prisma.appointment.deleteMany({ where: { id: appointmentId } });
      }
      if (clientId > 0) {
        await prisma.appointmentLog.deleteMany({ where: { clientId } });
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      // Por id: el filtro por fecha y hora (columna TIME) no coincide con el valor de creación.
      if (blockId > 0) {
        await prisma.blockedSlot.deleteMany({ where: { id: blockId } });
      }
      // Reglas y excepciones creadas por la UI durante la prueba: solo dentro de la fila activeMonth de este spec.
      if (ownMonthId !== null) {
        await prisma.availabilityRule.deleteMany({ where: { activeMonthId: ownMonthId } });
        await prisma.availabilityException.deleteMany({ where: { activeMonthId: ownMonthId } });
        await prisma.activeMonth.deleteMany({ where: { id: ownMonthId, month: TARGET_MONTH } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("S-06: the affected-appointments dialog lists the appointment and cancel writes nothing", async ({ page }) => {
    const appointmentBefore = await readAppointmentSnapshot(appointmentId);
    const stateBefore = await readMonthState();

    await loginAsAdmin(page);
    const editor = await openAvailabilityEditor(page);
    await addDefaultRule(editor);
    await editor.getByRole("button", { name: "Quitar hora 5:00 PM", exact: true }).click();
    await editor.getByRole("button", { name: "Guardar disponibilidad", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: AFFECTED_DIALOG_TITLE });
    await expect(dialog).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    // Solo la cita: el bloqueo manual del martes no cuenta (D40).
    await expect(dialog.getByRole("listitem")).toHaveCount(1);
    await expect(dialog.getByRole("listitem")).toContainText("E2E Availability Client");
    await expect(dialog.getByRole("listitem")).toContainText("Confirmada");
    // Fecha y hora de la cita tal como las muestra el diálogo (es-MX: "lun 14 de dic"; hora en formato 12 h).
    await expect(dialog.getByRole("listitem")).toContainText("14 de dic");
    await expect(dialog.getByRole("listitem")).toContainText("5:00 PM");

    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();

    await expect(dialog).toBeHidden({ timeout: FIRST_HIT_TIMEOUT });
    await expect(editor).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    expect(await readMonthState()).toEqual(stateBefore);
    expect(await readAppointmentSnapshot(appointmentId)).toBe(appointmentBefore);
  });

  test("S-06: confirming saves the rule and keeps the appointment unchanged", async ({ page }) => {
    const appointmentBefore = await readAppointmentSnapshot(appointmentId);
    const versionBefore = (await readMonthState()).version;

    await loginAsAdmin(page);
    const editor = await openAvailabilityEditor(page);
    await addDefaultRule(editor);
    await editor.getByRole("button", { name: "Quitar hora 5:00 PM", exact: true }).click();
    await editor.getByRole("button", { name: "Guardar disponibilidad", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: AFFECTED_DIALOG_TITLE });
    await expect(dialog).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await dialog.getByRole("button", { name: "Confirmar y guardar", exact: true }).click();

    await expect(page.getByText("Disponibilidad guardada")).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await expect(page.getByRole("dialog", { name: EDITOR_TITLE })).toBeHidden({ timeout: FIRST_HIT_TIMEOUT });

    const stateAfter = await readMonthState();
    expect(stateAfter.rules).toBe(1);
    // Cada guardado incrementa la versión exactamente en 1 (lib/db/availability-rules.ts).
    expect(stateAfter.version).toBe(versionBefore + 1);
    expect(await readRuleTimes()).toEqual([["09:00", "10:00", "13:00", "14:00", "18:00"]]);
    expect(await readAppointmentSnapshot(appointmentId)).toBe(appointmentBefore);
  });

  test("S-07: a save with an outdated version is rejected and the database does not change", async ({ page, context }) => {
    await loginAsAdmin(page);
    const staleEditor = await openAvailabilityEditor(page);
    await addDefaultRule(staleEditor);

    // Segunda pestaña del mismo mes (misma sesión de admin): guarda primero y sube la versión.
    const secondTab = await context.newPage();
    const freshEditor = await openAvailabilityEditor(secondTab);
    await addDefaultRule(freshEditor);
    await freshEditor.getByRole("button", { name: "Guardar disponibilidad", exact: true }).click();
    await expect(secondTab.getByText("Disponibilidad guardada")).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await expect(secondTab.getByRole("dialog", { name: EDITOR_TITLE })).toBeHidden({ timeout: FIRST_HIT_TIMEOUT });
    await secondTab.close();

    const stateAfterSecondSave = await readMonthState();
    expect(stateAfterSecondSave.rules).toBe(1);

    // La primera pestaña sigue con la versión anterior: el guardado debe rechazarse con 409 y el código de versión.
    const staleSave = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/admin/months/${TARGET_MONTH}/availability`,
    );
    await staleEditor.getByRole("button", { name: "Guardar disponibilidad", exact: true }).click();
    const response = await staleSave;
    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "AVAILABILITY_VERSION_CONFLICT" });

    await expect(page.getByText("No se pudo guardar la disponibilidad")).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await expect(page.getByText(/cambió mientras editabas/)).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });
    await expect(staleEditor).toBeVisible({ timeout: FIRST_HIT_TIMEOUT });

    expect(await readMonthState()).toEqual(stateAfterSecondSave);
    expect(await readRuleTimes()).toEqual([["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"]]);
  });
});
