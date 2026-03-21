import { expect, test, type APIRequestContext } from "@playwright/test";

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

async function createConfirmedAppointment(
  request: APIRequestContext,
  input: { name: string },
) {
  let lastError = "UNKNOWN_ERROR";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slot = await getBookableSlot(request);
    const phone = getUniquePhone();
    const lockResponse = await request.post("/api/reservar/client-check-lock", {
      data: {
        phone,
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    if (lockResponse.status() !== 201) {
      const lockPayload = (await lockResponse.json()) as {
        errorCode?: string;
        error?: string;
      };
      lastError = lockPayload.errorCode ?? lockPayload.error ?? `LOCK_STATUS_${lockResponse.status()}`;
      continue;
    }

    const lockPayload = (await lockResponse.json()) as { lockToken: string };
    const confirmResponse = await request.post("/api/reservar/confirm", {
      data: {
        name: input.name,
        phone,
        date: slot.date,
        timeSlot: slot.timeSlot,
        lockToken: lockPayload.lockToken,
      },
    });

    if (confirmResponse.status() === 201) {
      return {
        phone,
        date: slot.date,
        timeSlot: slot.timeSlot,
      };
    }

    const confirmPayload = (await confirmResponse.json()) as {
      errorCode?: string;
      error?: string;
    };
    lastError =
      confirmPayload.errorCode ??
      confirmPayload.error ??
      `CONFIRM_STATUS_${confirmResponse.status()}`;

    await request.delete("/api/reservar/lock", {
      data: { lockToken: lockPayload.lockToken },
    });
  }

  throw new Error(`Unable to create confirmed appointment after retries: ${lastError}`);
}

test("home exposes cancellation entrypoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Cancelar cita" })).toBeVisible();
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
    appointmentId: number;
  };

  const cancellationResponse = await request.post("/api/cancelar", {
    data: {
      phone: appointment.phone,
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
  const appointment = await createConfirmedAppointment(request, {
    name: "E2E Wizard Cancel",
  });

  await page.goto("/cancelar");
  await page.locator("#cancel-phone").fill(appointment.phone);
  await page.getByRole("button", { name: "Buscar cita" }).click();

  await expect(page.getByRole("heading", { name: /Confirmar Cancelaci.n/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();

  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Tu cita ha sido cancelada con .xito/i,
    }),
  ).toBeVisible();
});
