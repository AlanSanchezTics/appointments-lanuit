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

async function seedAgendaForE2E() {
  const month = getCurrentMonthKey();
  const today = getTodayInMexicoCity();
  const appointmentDate = getNextWeekday(addDays(today, 1));
  const uniquePhone = `55${Date.now().toString().slice(-8)}`;

  await prisma.activeMonth.upsert({
    where: { month },
    update: { status: "ACTIVE" },
    create: { month, status: "ACTIVE" },
  });

  const client = await prisma.client.create({
    data: {
      name: "E2E Day Agenda",
      phone: uniquePhone,
    },
  });

  await prisma.appointment.create({
    data: {
      clientId: client.id,
      date: toSqlDateTime(appointmentDate, "00:00:00"),
      timeSlot: toSqlDateTime(appointmentDate, "09:00:00"),
      status: "CONFIRMED",
    },
  });
}

e2eSuite("admin months detail e2e", () => {
  test.beforeAll(async () => {
    await ensureE2EAdminUser();
    await seedAgendaForE2E();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("navigates from months catalog to month detail", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#admin-username").fill(E2E_ADMIN_USERNAME);
    await page.locator("#admin-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Iniciar sesi.n|Sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("link", { name: /Gesti.n de meses|Month management/i }).click();
    await expect(page).toHaveURL(/\/admin\/months$/);

    const monthRow = page.locator('div[role="button"]').first();
    await expect(monthRow).toBeVisible();
    await monthRow.click();

    await expect(page).toHaveURL(/\/admin\/months\/\d{4}-\d{2}$/);
    await expect(
      page.getByRole("heading", {
        name: /Ocupaci.n proyectada para este mes|Projected occupancy for this month/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Vista mensual|Monthly view/i,
      }),
    ).toBeVisible();
  });

  test("opens day agenda modal from calendar and allows closing it", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#admin-username").fill(E2E_ADMIN_USERNAME);
    await page.locator("#admin-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Iniciar sesi.n|Sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("link", { name: /Gesti.n de meses|Month management/i }).click();
    await expect(page).toHaveURL(/\/admin\/months$/);

    const monthRow = page.locator('div[role="button"]').first();
    await expect(monthRow).toBeVisible();
    await monthRow.click();
    await expect(page).toHaveURL(/\/admin\/months\/\d{4}-\d{2}$/);

    const dayButton = page.getByRole("button", {
      name: /Detalles del|Details for/i,
    }).first();
    await expect(dayButton).toBeVisible();
    await dayButton.click();

    const dayDialog = page.getByRole("dialog", { name: /Detalles del|Details for/i });
    await expect(dayDialog).toBeVisible();
    await expect(page.getByText(/Agenda del d.a|Day agenda/i)).toBeVisible();

    await page.getByRole("button", { name: /Cerrar|Close/i }).first().click();
    await expect(dayDialog).toBeHidden();
  });
});
