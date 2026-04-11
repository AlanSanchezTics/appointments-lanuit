import { expect, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getActiveMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 7);
}

function getMonthCandidates(size: number) {
  const months: string[] = [];
  let cursor = getActiveMonth();

  for (let index = 0; index < size; index += 1) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }

  return months;
}

function getMexicoCityDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getUniquePhone() {
  const suffix = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  return `55${suffix}`;
}

type AvailabilityPayload = {
  days: Array<{ date: string; slots: string[] }>;
};

async function getBookableSlot(request: APIRequestContext) {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setUTCDate(minDate.getUTCDate() + 2);
  const minDateKey = getMexicoCityDateKey(minDate);

  for (const month of getMonthCandidates(3)) {
    const availabilityResponse = await request.get(`/api/availability/${month}`);
    if (!availabilityResponse.ok()) {
      continue;
    }

    const availability = (await availabilityResponse.json()) as AvailabilityPayload;
    if (!availability.days.length) {
      continue;
    }

    const day =
      availability.days.find((entry) => entry.date >= minDateKey && entry.slots.length > 0) ??
      availability.days.find((entry) => entry.slots.length > 0);
    if (!day) {
      continue;
    }

    return {
      date: day.date,
      timeSlot: day.slots[0],
    };
  }

  throw new Error("No available slot found in active month candidates");
}

function toSqlDateTime(dateString: string, time: string) {
  return new Date(`${dateString}T${time}:00.000Z`);
}

async function createConfirmedAppointment(request: APIRequestContext, input: { name: string }) {
  const slot = await getBookableSlot(request);
  const phone = getUniquePhone();
  const { _max } = await prisma.client.aggregate({
    _max: {
      clientNumber: true,
    },
  });
  const nextClientNumber = (_max.clientNumber ?? 0) + 1;

  const client = await prisma.client.create({
    data: {
      name: input.name,
      phone,
      clientNumber: nextClientNumber,
    },
  });

  await prisma.appointment.create({
    data: {
      clientId: client.id,
      date: toSqlDateTime(slot.date, "00:00"),
      timeSlot: toSqlDateTime(slot.date, slot.timeSlot),
      status: "CONFIRMED",
    },
  });

  return {
    phone,
    date: slot.date,
    timeSlot: slot.timeSlot,
  };
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("home exposes cancellation entrypoint", async ({ page }) => {
  await page.goto("/");

  const cancelLink = page.getByRole("link", { name: "Cancelar cita" });
  await expect(cancelLink).toBeVisible();
  await expect(cancelLink).toHaveAttribute("href", "/citas/cancelar");
});

test("booking can be cancelled through the public endpoints", async ({ request }) => {
  const appointment = await createConfirmedAppointment(request, {
    name: "E2E Cancel",
  });

  const lookupResponse = await request.post("/api/cancelar/buscar", {
    data: {
      phone: appointment.phone,
    },
  });

  expect(lookupResponse.status()).toBe(200);
  const lookupPayload = (await lookupResponse.json()) as {
    appointments: Array<{ appointmentId: number }>;
  };
  const appointmentId = lookupPayload.appointments[0]?.appointmentId;
  if (!appointmentId) {
    throw new Error("No cancelable appointments returned by lookup");
  }

  const cancellationResponse = await request.post("/api/cancelar", {
    data: {
      phone: appointment.phone,
      appointmentIds: [appointmentId],
    },
  });

  expect(cancellationResponse.status()).toBe(200);
  await expect(cancellationResponse.json()).resolves.toEqual({
    cancelledAppointments: [
      {
        appointmentId: expect.any(Number),
        status: "CANCELLED",
      },
    ],
  });
});

test("user completes cancellation wizard in three steps", async ({
  page,
  request,
}) => {
  const appointment = await createConfirmedAppointment(request, {
    name: "E2E Wizard Cancel",
  });

  await page.route("https://wa.me/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>ok</body></html>",
    });
  });

  await page.goto("/citas/cancelar");
  await page.locator("#cancel-phone").fill(appointment.phone);
  await page.getByRole("button", { name: "Buscar cita" }).click();

  await expect(page.getByRole("heading", { name: /Confirmar Cancelaci.n/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
  await page.getByRole("button", { name: /\d{2}:\d{2}\s?(AM|PM)/i }).first().click();

  await page.getByRole("button", { name: "Cancelar cita" }).click();

  let autoRedirected = true;
  try {
    await page.waitForURL(/https:\/\/wa\.me\//, { timeout: 4000 });
  } catch {
    autoRedirected = false;
  }

  if (!autoRedirected) {
    await expect(
      page.getByRole("heading", {
        name: /Tu cita ha sido cancelada con .xito/i,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Notificar por WhatsApp" }).click();
  }

  await expect(page).toHaveURL(/https:\/\/wa\.me\//);
});
