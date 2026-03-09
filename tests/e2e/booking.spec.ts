import { expect, test } from "@playwright/test";

test("home exposes booking entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Reservar ahora" })).toBeVisible();
});

test("booking endpoint returns a whatsapp redirect payload for a real slot", async ({ request }) => {
  const availabilityResponse = await request.get("/api/availability/2026-03");
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };
  const day = availability.days.find((entry) => entry.date === "2026-03-10") ?? availability.days[0];
  expect(day).toBeTruthy();

  const bookingResponse = await request.post("/api/reservar", {
    data: {
      name: "E2E Booking",
      phone: "5511111120",
      date: day.date,
      timeSlot: day.slots[0],
    },
  });

  expect(bookingResponse.status()).toBe(201);
  await expect(bookingResponse.json()).resolves.toMatchObject({
    status: expect.stringMatching(/CONFIRMED|SYNC_FAILED/),
    whatsappUrl: expect.stringContaining("https://wa.me/"),
  });
});

test("booking flow renders a local success step before WhatsApp", async ({ page, request }) => {
  const availabilityResponse = await request.get("/api/availability/2026-03");
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

  await page.goto("/citas/2026-03");
  await page.getByLabel("Nombre completo").fill("UI Wizard");
  await page.getByLabel("Telefono").fill("5511111122");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page.getByRole("heading", { name: "Confirmar Detalles" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar Cita" }).click();

  await expect(page.getByRole("heading", { name: "Tu cita ha sido agendada exitosamente" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar confirmacion por WhatsApp" }).click();
  await expect(page).toHaveURL(/https:\/\/wa\.me\//);
});
