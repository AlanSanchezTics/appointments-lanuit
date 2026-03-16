import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { bookAppointment } from "@/lib/appointments/book-appointment";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

type SlotRow = {
  id: number;
  client_id: number;
  name: string;
  phone: string;
  status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
};

integrationSuite("bookAppointment integration", () => {
  beforeEach(async () => {
    await resetAppointmentsTable();
  });

  afterAll(async () => {
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("persists a confirmed appointment", async () => {
    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result.status).toBe("CONFIRMED");

    const appointment = await prisma.appointment.findFirstOrThrow({
      where: {
        client: {
          phone: "5512345678",
        },
      },
    });

    expect(appointment.status).toBe("CONFIRMED");
  });

  it("rejects a second future booking for the same phone", async () => {
    await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-05",
          timeSlot: "13:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("PHONE_ALREADY_BOOKED");
  });

  it("allows booking a slot that was previously cancelled", async () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    const initial = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      now,
    );

    await prisma.appointment.update({
      where: {
        id: initial.appointmentId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    const rebooked = await bookAppointment(
      {
        name: "Bety Ruiz",
        phone: "5512345679",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      now,
    );

    expect(rebooked.status).toBe("CONFIRMED");

    const appointments = await prisma.$queryRaw<Array<SlotRow>>`
      SELECT a.id, a.client_id, c.name, c.phone, a.status
      FROM appointments a
      INNER JOIN clients c
        ON c.id = a.client_id
      WHERE date = '2026-03-04'
        AND time_slot = '09:00:00'
      ORDER BY a.id ASC
    `;

    expect(appointments).toHaveLength(2);
    expect(appointments[0]?.status).toBe("CANCELLED");
    expect(appointments[0]?.phone).toBe("5512345678");
    expect(appointments[1]?.status).toBe("CONFIRMED");
    expect(appointments[1]?.phone).toBe("5512345679");
  });

  it("allows only one active booking when two requests race for the exact same slot", async () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    const results = await Promise.allSettled([
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        },
        now,
      ),
      bookAppointment(
        {
          name: "Bety Ruiz",
          phone: "5512345679",
          date: "2026-03-04",
          timeSlot: "09:00",
        },
        now,
      ),
    ]);

    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(Error);
    expect((rejectionReason as Error).message).toBe("SLOT_NOT_AVAILABLE");

    const activeInSlot = await prisma.$queryRaw<Array<SlotRow>>`
      SELECT a.id, a.client_id, c.name, c.phone, a.status
      FROM appointments a
      INNER JOIN clients c
        ON c.id = a.client_id
      WHERE date = '2026-03-04'
        AND time_slot = '09:00:00'
        AND a.status IN ('CONFIRMED', 'SYNC_FAILED')
    `;

    expect(activeInSlot).toHaveLength(1);
  });

  it("rejects concurrent bookings in the same pair on the same day", async () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    const results = await Promise.allSettled([
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        },
        now,
      ),
      bookAppointment(
        {
          name: "Bety Ruiz",
          phone: "5512345679",
          date: "2026-03-04",
          timeSlot: "10:00",
        },
        now,
      ),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);

    const records = await prisma.appointment.findMany({
      where: {
        date: new Date("2026-03-04T00:00:00.000Z"),
      },
    });

    expect(records).toHaveLength(1);
  });

  it("rejects booking a slot that violates backward spacing with a later occupied slot", async () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "17:00",
      },
      now,
    );

    await expect(
      bookAppointment(
        {
          name: "Bety Ruiz",
          phone: "5512345679",
          date: "2026-03-04",
          timeSlot: "14:00",
        },
        now,
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
  });

  it("rejects a fourth active booking on the same day", async () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      now,
    );

    await bookAppointment(
      {
        name: "Bety Ruiz",
        phone: "5512345679",
        date: "2026-03-04",
        timeSlot: "13:00",
      },
      now,
    );

    await bookAppointment(
      {
        name: "Carla Diaz",
        phone: "5512345680",
        date: "2026-03-04",
        timeSlot: "18:00",
      },
      now,
    );

    await expect(
      bookAppointment(
        {
          name: "Diana Mora",
          phone: "5512345681",
          date: "2026-03-04",
          timeSlot: "18:00",
        },
        now,
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
  });
});
