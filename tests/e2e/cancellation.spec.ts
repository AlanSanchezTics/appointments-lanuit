import { expect, test, type APIRequestContext } from "@playwright/test";

async function getActiveSlot(request: APIRequestContext) {
  const activeMonth = new Date().toISOString().slice(0, 7);
  const availabilityResponse = await request.get(`/api/availability/${activeMonth}`);
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };

  expect(availability.days.length).toBeGreaterThan(0);
  const day = availability.days[0];
  expect(day?.slots.length).toBeGreaterThan(0);

  return {
    date: day?.date ?? "",
    timeSlot: day?.slots[0] ?? "",
  };
}

test("home exposes cancellation entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Cancelar cita" })).toBeVisible();
});

test("booking can be cancelled through the public endpoints", async ({ request }) => {
  const slot = await getActiveSlot(request);

  const bookingResponse = await request.post("/api/reservar", {
    data: {
      name: "E2E Cancel",
      phone: "5511111121",
      date: slot.date,
      timeSlot: slot.timeSlot,
    },
  });

  expect(bookingResponse.status()).toBe(201);

  const lookupResponse = await request.post("/api/cancelar/buscar", {
    data: {
      phone: "5511111121",
    },
  });

  expect(lookupResponse.status()).toBe(200);
  const lookupPayload = (await lookupResponse.json()) as {
    appointmentId: number;
  };

  const cancellationResponse = await request.post("/api/cancelar", {
    data: {
      phone: "5511111121",
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

  const bookingResponse = await request.post("/api/reservar", {
    data: {
      name: "E2E Wizard Cancel",
      phone: "5511111122",
      date: slot.date,
      timeSlot: slot.timeSlot,
    },
  });

  expect(bookingResponse.status()).toBe(201);

  await page.goto("/cancelar");
  await page.getByLabel("Telefono").fill("5511111122");
  await page.getByRole("button", { name: "Buscar cita" }).click();

  await expect(page.getByRole("heading", { name: "Revisa tu cita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Regresar al inicio" })).toBeVisible();

  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tu cita ha sido cancelada con exito",
    }),
  ).toBeVisible();
});
