import { expect, test } from "@playwright/test";

test("home exposes cancellation entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Cancelar cita" })).toBeVisible();
});

test("booking can be cancelled through the public endpoints", async ({ request }) => {
  const bookingResponse = await request.post("/api/reservar", {
    data: {
      name: "E2E Cancel",
      phone: "5511111121",
      date: "2026-03-11",
      timeSlot: "13:00",
    },
  });

  expect(bookingResponse.status()).toBe(201);

  const cancellationResponse = await request.post("/api/cancelar", {
    data: {
      phone: "5511111121",
    },
  });

  expect(cancellationResponse.status()).toBe(200);
  await expect(cancellationResponse.json()).resolves.toEqual({
    appointmentId: expect.any(Number),
    status: "CANCELLED",
  });
});
