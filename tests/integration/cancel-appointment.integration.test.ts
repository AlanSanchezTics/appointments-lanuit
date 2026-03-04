import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelAppointment } from "@/lib/appointments/cancel-appointment";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/google", () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationSuite = hasDatabase ? describe : describe.skip;

integrationSuite("cancelAppointment integration", () => {
  beforeEach(async () => {
    await resetAppointmentsTable();
  });

  afterAll(async () => {
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("cancels a future appointment and clears the google event id", async () => {
    const appointment = await prisma.appointment.create({
      data: {
        name: "Ana Lopez",
        phone: "5512345678",
        date: new Date("2026-03-04T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
        status: "CONFIRMED",
        googleEventId: "google-event-1",
      },
    });

    const result = await cancelAppointment(
      {
        phone: "5512345678",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result).toEqual({
      appointmentId: appointment.id,
      status: "CANCELLED",
    });

    const refreshed = await prisma.appointment.findUniqueOrThrow({
      where: {
        id: appointment.id,
      },
    });

    expect(refreshed.status).toBe("CANCELLED");
    expect(refreshed.googleEventId).toBeNull();
  });
});
