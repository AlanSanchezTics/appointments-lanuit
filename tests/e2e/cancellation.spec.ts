import { expect, test, type APIRequestContext } from "@playwright/test";

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

async function getActiveSlot(request: APIRequestContext) {
  const activeMonth = getActiveMonth();
  const availabilityResponse = await request.get(`/api/availability/${activeMonth}`);
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };

  expect(availability.days.length).toBeGreaterThan(0);

  const now = new Date();
  const minDate = new Date(now);
  minDate.setUTCDate(minDate.getUTCDate() + 2);
  const minDateKey = minDate.toISOString().slice(0, 10);

  const day = availability.days.find((entry) => entry.date >= minDateKey) ?? availability.days[0];
  expect(day?.slots.length).toBeGreaterThan(0);

  return {
    date: day?.date ?? "",
    timeSlot: day?.slots[0] ?? "",
  };
}

async function createConfirmedAppointment(
  request: APIRequestContext,
  input: { name: string; phone: string; date: string; timeSlot: string },
) {
  const lockResponse = await request.post("/api/reservar/client-check-lock", {
    data: {
      phone: input.phone,
      date: input.date,
      timeSlot: input.timeSlot,
    },
  });

  expect(lockResponse.status()).toBe(201);
  const lockPayload = (await lockResponse.json()) as { lockToken: string };

  const confirmResponse = await request.post("/api/reservar/confirm", {
    data: {
      name: input.name,
      phone: input.phone,
      date: input.date,
      timeSlot: input.timeSlot,
      lockToken: lockPayload.lockToken,
    },
  });

  expect(confirmResponse.status()).toBe(201);
}

test("home exposes cancellation entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Cancelar cita" })).toBeVisible();
});

test("booking can be cancelled through the public endpoints", async ({ request }) => {
  const slot = await getActiveSlot(request);
  const phone = getUniquePhone();

  await createConfirmedAppointment(request, {
    name: "E2E Cancel",
    phone,
    date: slot.date,
    timeSlot: slot.timeSlot,
  });

  const lookupResponse = await request.post("/api/cancelar/buscar", {
    data: {
      phone,
    },
  });

  expect(lookupResponse.status()).toBe(200);
  const lookupPayload = (await lookupResponse.json()) as {
    appointmentId: number;
  };

  const cancellationResponse = await request.post("/api/cancelar", {
    data: {
      phone,
      appointmentId: lookupPayload.appointmentId,
    },
  });

  expect(cancellationResponse.status()).toBe(200);
  await expect(cancellationResponse.json()).resolves.toEqual({
    appointmentId: expect.any(Number),
    status: "CANCELLED",
  });
});

test("user completes cancellation wizard in three steps", async ({
  page,
  request,
}) => {
  const slot = await getActiveSlot(request);
  const phone = getUniquePhone();

  await createConfirmedAppointment(request, {
    name: "E2E Wizard Cancel",
    phone,
    date: slot.date,
    timeSlot: slot.timeSlot,
  });

  await page.goto("/cancelar");
  await page.locator("#cancel-phone").fill(phone);
  await page.getByRole("button", { name: "Buscar cita" }).click();

  await expect(page.getByRole("heading", { name: /Confirmar Cancelaci.n/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toBeVisible();

  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Tu cita ha sido cancelada con .xito/i,
    }),
  ).toBeVisible();
});
