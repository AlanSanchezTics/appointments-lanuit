import { expect, test, type APIRequestContext } from "@playwright/test";

import { prisma } from "../../lib/db/prisma";

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_E2E_DB === "1";
const e2eSuite = hasDatabase ? test.describe : test.describe.skip;

function getActiveMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function getActiveSlot(request: APIRequestContext) {
  const month = getActiveMonth();
  const availabilityResponse = await request.get(`/api/availability/${month}`);
  expect(availabilityResponse.ok()).toBeTruthy();

  const availability = (await availabilityResponse.json()) as {
    days: Array<{ date: string; slots: string[] }>;
  };

  const day = availability.days[0];
  expect(day).toBeTruthy();
  expect(day?.slots.length).toBeGreaterThan(0);

  return {
    month,
    date: day?.date ?? "",
    timeSlot: day?.slots[0] ?? "",
  };
}

e2eSuite("reservation lock e2e", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("blocks a second user while lock is active", async ({ request }) => {
    const slot = await getActiveSlot(request);

    const firstLockResponse = await request.post("/api/reservar/lock", {
      data: {
        name: "E2E Lock A",
        phone: "5511111130",
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    expect(firstLockResponse.status()).toBe(201);
    const firstLock = (await firstLockResponse.json()) as { lockToken: string };

    const secondLockResponse = await request.post("/api/reservar/lock", {
      data: {
        name: "E2E Lock B",
        phone: "5511111131",
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    expect(secondLockResponse.status()).toBe(409);
    await expect(secondLockResponse.json()).resolves.toMatchObject({
      error: "SLOT_LOCKED",
    });

    await request.delete("/api/reservar/lock", {
      data: {
        lockToken: firstLock.lockToken,
      },
    });
  });

  test("releases lock when user goes back and allows another lock", async ({ request }) => {
    const slot = await getActiveSlot(request);

    const firstLockResponse = await request.post("/api/reservar/lock", {
      data: {
        name: "E2E Back A",
        phone: "5511111132",
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    expect(firstLockResponse.status()).toBe(201);
    const firstLock = (await firstLockResponse.json()) as { lockToken: string };

    const releaseResponse = await request.delete("/api/reservar/lock", {
      data: {
        lockToken: firstLock.lockToken,
      },
    });

    expect(releaseResponse.status()).toBe(200);

    const secondLockResponse = await request.post("/api/reservar/lock", {
      data: {
        name: "E2E Back B",
        phone: "5511111133",
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    expect(secondLockResponse.status()).toBe(201);
    const secondLock = (await secondLockResponse.json()) as { lockToken: string };

    await request.delete("/api/reservar/lock", {
      data: {
        lockToken: secondLock.lockToken,
      },
    });
  });

  test("makes slot available again after lock expiration", async ({ request }) => {
    const slot = await getActiveSlot(request);

    const lockResponse = await request.post("/api/reservar/lock", {
      data: {
        name: "E2E Expire",
        phone: "5511111134",
        date: slot.date,
        timeSlot: slot.timeSlot,
      },
    });

    expect(lockResponse.status()).toBe(201);
    const lock = (await lockResponse.json()) as { lockToken: string };

    const unavailableResponse = await request.get(`/api/availability/${slot.month}`);
    const unavailablePayload = (await unavailableResponse.json()) as {
      days: Array<{ date: string; slots: string[] }>;
    };
    const unavailableDay = unavailablePayload.days.find((day) => day.date === slot.date);
    expect(unavailableDay?.slots.includes(slot.timeSlot)).toBeFalsy();

    await prisma.reservationLock.updateMany({
      where: {
        lockToken: lock.lockToken,
      },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const availableResponse = await request.get(`/api/availability/${slot.month}`);
    const availablePayload = (await availableResponse.json()) as {
      days: Array<{ date: string; slots: string[] }>;
    };
    const availableDay = availablePayload.days.find((day) => day.date === slot.date);

    expect(availableDay?.slots.includes(slot.timeSlot)).toBeTruthy();
  });
});
