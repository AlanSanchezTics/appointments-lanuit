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

const seededAppointmentIds: number[] = [];
const seededPhones: string[] = [];
const seededReminders: Array<{
  appointmentId: number;
  clientName: string;
  phone: string;
}> = [];

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

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

async function seedDashboardRemindersForE2E() {
  const today = getTodayInMexicoCity();
  const nextDay = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const baseTag = String(Date.now()).slice(-5);

  const nextDayPhone = getUniquePhone("D");
  const nextWeekPhone = getUniquePhone("W");

  seededPhones.push(nextDayPhone, nextWeekPhone);

  const seededAppointments: Array<{
    clientName: string;
    phone: string;
    date: string;
    timeSlot: string;
  }> = [
    {
      clientName: `E2E Reminder Tomorrow ${baseTag}`,
      phone: nextDayPhone,
      date: nextDay,
      timeSlot: "09:00:00",
    },
    {
      clientName: `E2E Reminder Next Week ${baseTag}`,
      phone: nextWeekPhone,
      date: nextWeek,
      timeSlot: "13:00:00",
    },
  ];

  const { _max } = await prisma.client.aggregate({
    _max: {
      clientNumber: true,
    },
  });
  let nextClientNumber = (_max.clientNumber ?? 0) + 1;

  for (const appointment of seededAppointments) {
    const client = await prisma.client.create({
      data: {
        clientNumber: nextClientNumber,
        name: appointment.clientName,
        phone: appointment.phone,
      },
    });
    nextClientNumber += 1;

    const createdAppointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        date: toSqlDateTime(appointment.date, "00:00:00"),
        timeSlot: toSqlDateTime(appointment.date, appointment.timeSlot),
        status: "CONFIRMED",
      },
    });

    seededAppointmentIds.push(createdAppointment.id);
    seededReminders.push({
      appointmentId: createdAppointment.id,
      clientName: appointment.clientName,
      phone: appointment.phone,
    });
  }
}

async function cleanupSeededReminders() {
  if (seededAppointmentIds.length > 0) {
    await prisma.appointment.deleteMany({
      where: {
        id: {
          in: seededAppointmentIds,
        },
      },
    });
  }

  if (seededPhones.length > 0) {
    await prisma.client.deleteMany({
      where: {
        phone: {
          in: seededPhones,
        },
      },
    });
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

e2eSuite("admin dashboard reminders e2e", () => {
  test.beforeAll(async () => {
    seededAppointmentIds.length = 0;
    seededPhones.length = 0;
    seededReminders.length = 0;

    await ensureE2EAdminUser();
    await seedDashboardRemindersForE2E();
  });

  test.afterAll(async () => {
    await cleanupSeededReminders();
    await prisma.$disconnect();
  });

  test("logs in, renders reminder sections, and opens WhatsApp reminder link", async ({
    page,
  }) => {
    if (seededReminders.length < 2) {
      throw new Error("E2E reminders were not seeded correctly.");
    }

    const [nextDayReminder, nextWeekReminder] = seededReminders;

    await page.goto("/admin/login");
    await page.locator("#admin-username").fill(E2E_ADMIN_USERNAME);
    await page.locator("#admin-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Iniciar sesi.n|Sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.evaluate(() => {
      const win = window as Window & {
        __openCalls?: Array<{ url: string; target?: string | null; features?: string | null }>;
      };

      win.__openCalls = [];
      window.open = ((url, target, features) => {
        win.__openCalls?.push({
          url: String(url ?? ""),
          target: target ?? null,
          features: features ?? null,
        });

        return null;
      }) as typeof window.open;
    });

    await page.route("https://wa.me/**", async (route) => {
      await route.abort();
    });

    await expect(page.getByRole("heading", { name: "Recordatorios" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Citas para ma\u00f1ana" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Citas para la pr\u00f3xima semana" }),
    ).toBeVisible();

    await expect(page.getByText(nextDayReminder.clientName, { exact: true })).toBeVisible();
    await expect(page.getByText(nextWeekReminder.clientName, { exact: true })).toBeVisible();

    const sendReminderButton = page.getByRole("button", {
      name: new RegExp(`Enviar recordatorio a ${escapeRegex(nextDayReminder.clientName)}`),
    });

    await expect(sendReminderButton).toBeVisible();

    await sendReminderButton.click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const win = window as Window & {
          __openCalls?: Array<{ url: string; target?: string | null; features?: string | null }>;
        };

        return win.__openCalls?.length ?? 0;
      });
    }).toBe(1);

    const openedUrl = await page.evaluate(() => {
      const win = window as Window & {
        __openCalls?: Array<{ url: string; target?: string | null; features?: string | null }>;
      };

      return win.__openCalls?.[0]?.url ?? "";
    });

    const parsedUrl = new URL(openedUrl);

    expect(parsedUrl.origin).toBe("https://wa.me");
    expect(parsedUrl.pathname).toBe(`/52${nextDayReminder.phone}`);
    expect(decodeURIComponent(parsedUrl.searchParams.get("text") ?? "")).toContain(
      nextDayReminder.clientName,
    );
  });
});
