import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelAppointment } from "@/lib/appointments/cancel-appointment";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

const { deleteCalendarEventMock } = vi.hoisted(() => ({
  deleteCalendarEventMock: vi.fn(async () => undefined),
}));

vi.mock("@/lib/calendar/google", () => ({
  deleteCalendarEvent: deleteCalendarEventMock,
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

integrationSuite("cancelAppointment integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
        appointmentId: appointment.id,
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

  it("keeps google_event_id for retry when Google deletion fails", async () => {
    deleteCalendarEventMock.mockRejectedValueOnce(new Error("boom"));

    const appointment = await prisma.appointment.create({
      data: {
        name: "Ana Lopez",
        phone: "5512345678",
        date: new Date("2026-03-04T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
        status: "CONFIRMED",
        googleEventId: "google-event-2",
      },
    });

    const result = await cancelAppointment(
      {
        phone: "5512345678",
        appointmentId: appointment.id,
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result).toEqual({
      appointmentId: appointment.id,
      status: "CANCELLED",
      syncReason: "CALENDAR_DELETE_FAILED",
    });

    const refreshed = await prisma.appointment.findUniqueOrThrow({
      where: {
        id: appointment.id,
      },
    });

    expect(refreshed.status).toBe("CANCELLED");
    expect(refreshed.googleEventId).toBe("google-event-2");
  });

  it("rejects cancellation when the appointment is not CONFIRMED", async () => {
    const appointment = await prisma.appointment.create({
      data: {
        name: "Ana Lopez",
        phone: "5512345678",
        date: new Date("2026-03-04T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
        status: "SYNC_FAILED",
      },
    });

    await expect(
      cancelAppointment(
        {
          phone: "5512345678",
          appointmentId: appointment.id,
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");
  });
});
