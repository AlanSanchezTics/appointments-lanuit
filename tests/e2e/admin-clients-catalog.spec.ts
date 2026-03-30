import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPasswordHash } from "../../lib/admin/auth/service";
import { prisma } from "../../lib/db/prisma";

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_E2E_DB === "1";
const e2eSuite = hasDatabase ? test.describe : test.describe.skip;

const E2E_ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "e2e-admin";
const E2E_ADMIN_NAME = process.env.E2E_ADMIN_NAME ?? "E2E Admin";
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123";

const seededPhones: string[] = [];
let targetClientName = "";
let updatedClientName = "";

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

async function ensureE2EAdminUser() {
  ensurePepperInProcessEnv();
  const { hash, salt } = createPasswordHash(E2E_ADMIN_PASSWORD);

  await prisma.adminUser.upsert({
    where: {
      username: E2E_ADMIN_USERNAME,
    },
    update: {
      name: E2E_ADMIN_NAME,
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
    },
    create: {
      username: E2E_ADMIN_USERNAME,
      name: E2E_ADMIN_NAME,
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
    },
  });
}

function getTodayInMexicoCity(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getCurrentMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isWeekend(dateString: string) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function getNextWeekday(startDate: string) {
  let cursor = startDate;
  while (isWeekend(cursor)) {
    cursor = addDays(cursor, 1);
  }

  return cursor;
}

function toSqlDateTime(dateString: string, time: string) {
  return new Date(`${dateString}T${time}.000Z`);
}

function getUniquePhone(seed: string) {
  const suffix = String(Date.now()).slice(-6);
  const seedDigits = seed
    .split("")
    .map((char) => String(char.charCodeAt(0) % 10))
    .join("")
    .slice(0, 2)
    .padEnd(2, "7");
  return `55${seedDigits}${suffix}`;
}

async function seedClientsCatalogForE2E() {
  const month = getCurrentMonthKey();
  const today = getTodayInMexicoCity();
  const futureDate = getNextWeekday(addDays(today, 2));
  const baseTag = String(Date.now()).slice(-5);

  targetClientName = `E2E Cliente ${baseTag}`;
  updatedClientName = `${targetClientName} Editado`;

  await prisma.activeMonth.upsert({
    where: { month },
    update: { status: "ACTIVE" },
    create: { month, status: "ACTIVE" },
  });

  const phoneWithFuture = getUniquePhone("A");
  const phoneWithoutFuture = getUniquePhone("B");

  seededPhones.push(phoneWithFuture, phoneWithoutFuture);

  const clientWithFuture = await prisma.client.create({
    data: {
      name: targetClientName,
      phone: phoneWithFuture,
    },
  });

  await prisma.client.create({
    data: {
      name: `E2E Sin Futura ${baseTag}`,
      phone: phoneWithoutFuture,
    },
  });

  await prisma.appointment.create({
    data: {
      clientId: clientWithFuture.id,
      date: toSqlDateTime(futureDate, "00:00:00"),
      timeSlot: toSqlDateTime(futureDate, "09:00:00"),
      status: "CONFIRMED",
    },
  });
}

async function cleanupSeededClients() {
  if (seededPhones.length === 0) {
    return;
  }

  const clients = await prisma.client.findMany({
    where: {
      phone: {
        in: seededPhones,
      },
    },
    select: {
      id: true,
    },
  });

  const clientIds = clients.map((entry) => entry.id);

  if (clientIds.length > 0) {
    await prisma.appointment.deleteMany({
      where: {
        clientId: {
          in: clientIds,
        },
      },
    });
  }

  await prisma.client.deleteMany({
    where: {
      phone: {
        in: seededPhones,
      },
    },
  });
}

e2eSuite("admin clients catalog e2e", () => {
  test.beforeAll(async () => {
    await ensureE2EAdminUser();
    await seedClientsCatalogForE2E();
  });

  test.afterAll(async () => {
    await cleanupSeededClients();
    await prisma.$disconnect();
  });

  test("allows filtering clients, opening detail and editing name", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#admin-username").fill(E2E_ADMIN_USERNAME);
    await page.locator("#admin-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Iniciar sesi.n|Sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);

    await page.getByTestId("sidebar-item-clients").click();
    await expect(page).toHaveURL(/\/admin\/clients$/);

    await expect(page.getByRole("heading", { name: /Listado de clientes|Clients list/i })).toBeVisible();
    await page.getByLabel(/Buscar|Search/i).fill(targetClientName);
    await page.getByRole("button", { name: /Aplicar filtros|Apply filters/i }).click();

    const clientRow = page.getByText(targetClientName, { exact: true });
    await expect(clientRow).toBeVisible();
    await clientRow.click();

    await expect(page).toHaveURL(/\/admin\/clients\/\d+$/);
    await expect(page.getByRole("heading", { name: targetClientName })).toBeVisible();

    await page.getByRole("button", { name: /Editar cliente|Edit client/i }).click();
    await page.getByLabel(/Nombre|Name/i).fill(updatedClientName);

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/clients/") &&
        response.request().method() === "PATCH" &&
        response.status() === 200,
    );

    await page.getByRole("button", { name: /Guardar|Save/i }).click();
    await updateResponsePromise;

    await expect(page.getByRole("heading", { name: updatedClientName })).toBeVisible();
  });
});
