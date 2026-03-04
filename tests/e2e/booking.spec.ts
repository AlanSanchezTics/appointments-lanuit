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
