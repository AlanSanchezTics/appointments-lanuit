import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { acquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

integrationSuite("reservation lock integration", () => {
  beforeEach(async () => {
    await resetAppointmentsTable();
  });

  afterAll(async () => {
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("allows only one active lock for the same slot", async () => {
    const now = new Date("2026-03-13T12:00:00.000Z");

    const results = await Promise.allSettled([
      acquireReservationSlotLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "09:00",
        },
        now,
      ),
      acquireReservationSlotLock(
        {
          name: "Bety Ruiz",
          phone: "5512345679",
          date: "2026-03-16",
          timeSlot: "09:00",
        },
        now,
      ),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);

    const rejectionReason = (results.find((item) => item.status === "rejected") as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(Error);
    expect((rejectionReason as Error).message).toBe("SLOT_LOCKED");

    const activeLocks = await prisma.reservationLock.findMany({
      where: {
        date: new Date("2026-03-16T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
      },
    });

    expect(activeLocks).toHaveLength(1);
  });

  it("rejects confirmation when the lock has already expired", async () => {
    const lock = await acquireReservationSlotLock(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-16",
        timeSlot: "09:00",
      },
      new Date("2026-03-13T12:00:00.000Z"),
    );

    await expect(
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "09:00",
          lockToken: lock.lockToken,
        },
        new Date("2026-03-13T12:11:00.000Z"),
      ),
    ).rejects.toThrow("LOCK_EXPIRED_OR_INVALID");
  });

  it("allows only one successful confirmation for the same lock token", async () => {
    const now = new Date("2026-03-13T12:00:00.000Z");
    const lock = await acquireReservationSlotLock(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-16",
        timeSlot: "09:00",
      },
      now,
    );

    const results = await Promise.allSettled([
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "09:00",
          lockToken: lock.lockToken,
        },
        now,
      ),
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "09:00",
          lockToken: lock.lockToken,
        },
        now,
      ),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);

    const rejectionReason = (results.find((item) => item.status === "rejected") as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(Error);
    expect((rejectionReason as Error).message).toBe("LOCK_EXPIRED_OR_INVALID");

    const appointments = await prisma.appointment.findMany({
      where: {
        date: new Date("2026-03-16T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
        status: {
          in: ["CONFIRMED", "SYNC_FAILED"],
        },
      },
    });

    expect(appointments).toHaveLength(1);
  });
});
