import { expect, test } from "@playwright/test";

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

  await expect(page.getByRole("link", { name: "Agendar ahora" })).toBeVisible();
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

test("booking flow renders a local success step before WhatsApp", async ({ page, request }) => {
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
  await expect(page.getByRole("link", { name: "Agendar cita" })).toBeVisible();
  await page.getByRole("link", { name: "Agendar cita" }).click();
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

  await expect(page.getByText(/Tu cita ha sido agendada con éxito/i)).toBeVisible();
  await page.getByRole("button", { name: /Enviar confirmaci.n por WhatsApp/i }).click();
  await expect(page).toHaveURL(/https:\/\/wa\.me\//);
});
