import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminDayAgenda, rescheduleAdminAppointment } from "@/lib/admin/appointments/service";

// Registro del orden de llamadas: D63 exige named locks → FOR SHARE → conflictos → FOR UPDATE de la cita.
const {
  calls,
  transactionMock,
  appointmentFindFirstMock,
  findRegisteredMonthMock,
  findMonthAvailabilityMock,
  findMonthAvailabilityForShareMock,
  acquireBookingLocksMock,
  releaseBookingLocksMock,
  cleanupExpiredReservationLocksMock,
  lockConflictingAppointmentsMock,
  findActiveAppointmentByIdInMonthForUpdateMock,
  listActiveAppointmentsByDateExcludingForUpdateMock,
  listBlockedSlotsByDateForUpdateMock,
  updateAppointmentScheduleByIdMock,
  listActiveAppointmentsByDateMock,
  listBlockingAppointmentsByDateMock,
  listBlockedSlotsByDateMock,
  listMonthActiveReservationLocksMock,
  createCalendarEventMock,
} = vi.hoisted(() => ({
  calls: [] as string[],
  transactionMock: vi.fn(),
  appointmentFindFirstMock: vi.fn(),
  findRegisteredMonthMock: vi.fn(),
  findMonthAvailabilityMock: vi.fn(),
  findMonthAvailabilityForShareMock: vi.fn(),
  acquireBookingLocksMock: vi.fn(),
  releaseBookingLocksMock: vi.fn(),
  cleanupExpiredReservationLocksMock: vi.fn(),
  lockConflictingAppointmentsMock: vi.fn(),
  findActiveAppointmentByIdInMonthForUpdateMock: vi.fn(),
  listActiveAppointmentsByDateExcludingForUpdateMock: vi.fn(),
  listBlockedSlotsByDateForUpdateMock: vi.fn(),
  updateAppointmentScheduleByIdMock: vi.fn(),
  listActiveAppointmentsByDateMock: vi.fn(),
  listBlockingAppointmentsByDateMock: vi.fn(),
  listBlockedSlotsByDateMock: vi.fn(),
  listMonthActiveReservationLocksMock: vi.fn(),
  createCalendarEventMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    appointment: { findFirst: appointmentFindFirstMock, update: vi.fn(async () => undefined) },
  },
}));

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: findRegisteredMonthMock,
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailability: findMonthAvailabilityMock,
  findMonthAvailabilityForShare: findMonthAvailabilityForShareMock,
}));

vi.mock("@/lib/db/appointments", () => ({
  acquireBookingLocks: acquireBookingLocksMock,
  releaseBookingLocks: releaseBookingLocksMock,
  cleanupExpiredReservationLocks: cleanupExpiredReservationLocksMock,
  lockConflictingAppointments: lockConflictingAppointmentsMock,
  findActiveReservationLockForSlotForUpdate: vi.fn(async () => null),
  listMonthActiveReservationLocks: listMonthActiveReservationLocksMock,
  BOOKING_TRANSACTION_OPTIONS: { timeout: 30_000 },
}));

vi.mock("@/lib/db/admin-appointments", () => ({
  findActiveAppointmentByIdInMonthForUpdate: findActiveAppointmentByIdInMonthForUpdateMock,
  listActiveAppointmentsByDateExcludingForUpdate: listActiveAppointmentsByDateExcludingForUpdateMock,
  listActiveAppointmentsByDate: listActiveAppointmentsByDateMock,
  listBlockingAppointmentsByDate: listBlockingAppointmentsByDateMock,
  updateAppointmentScheduleById: updateAppointmentScheduleByIdMock,
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listBlockedSlotsByDateForUpdate: listBlockedSlotsByDateForUpdateMock,
  listBlockedSlotsByDate: listBlockedSlotsByDateMock,
}));

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: createCalendarEventMock,
  deleteCalendarEvent: vi.fn(async () => undefined),
  updateCalendarEvent: vi.fn(async () => undefined),
  GoogleCalendarConfigError: class GoogleCalendarConfigError extends Error {},
}));

const NOW = new Date("2026-04-10T15:00:00.000Z");
const OWNER_PHONE = "5512345678";

// Reglas del preset BLOCK para abril: 22 de abril (miércoles) ofrece 10:00 y 13:00.
function buildConfig() {
  return {
    month: "2026-04",
    slotMode: "BLOCK_MODE" as const,
    availabilityVersion: 1,
    exceptions: [],
    rules: [
      {
        id: 1,
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        weekdays: [1, 2, 3, 4, 5],
        times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
        minGapMinutes: 240,
        preserveCapacity: true,
        maxPerDay: 3,
      },
    ],
  };
}

function recordCall(name: string, value?: unknown) {
  calls.push(name);
  return value;
}

describe("admin appointments: lock order (D63) and blocking occupancy (D68)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ tag: "tx" }),
    );
    findRegisteredMonthMock.mockResolvedValue({ month: "2026-04", status: "ACTIVE", slotMode: "BLOCK_MODE" });
    findMonthAvailabilityMock.mockResolvedValue(buildConfig());
    findMonthAvailabilityForShareMock.mockImplementation(async () => recordCall("findMonthAvailabilityForShare", buildConfig()));
    appointmentFindFirstMock.mockImplementation(async () => recordCall("appointment.findFirst", { client: { phone: OWNER_PHONE } }));
    acquireBookingLocksMock.mockImplementation(async () => recordCall("acquireBookingLocks"));
    releaseBookingLocksMock.mockImplementation(async () => recordCall("releaseBookingLocks"));
    cleanupExpiredReservationLocksMock.mockImplementation(async () => recordCall("cleanupExpiredReservationLocks"));
    lockConflictingAppointmentsMock.mockImplementation(async () => recordCall("lockConflictingAppointments"));
    findActiveAppointmentByIdInMonthForUpdateMock.mockImplementation(async () =>
      recordCall("findActiveAppointmentByIdInMonthForUpdate", {
        id: 9,
        name: "Ana Lopez",
        phone: OWNER_PHONE,
        date: "2026-04-22",
        timeSlot: "13:00",
        googleEventId: null,
      }),
    );
    listActiveAppointmentsByDateExcludingForUpdateMock.mockResolvedValue([]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
    updateAppointmentScheduleByIdMock.mockImplementation(async () => recordCall("updateAppointmentScheduleById"));
    listActiveAppointmentsByDateMock.mockResolvedValue([]);
    listBlockingAppointmentsByDateMock.mockResolvedValue([]);
    listBlockedSlotsByDateMock.mockResolvedValue([]);
    listMonthActiveReservationLocksMock.mockResolvedValue([]);
    createCalendarEventMock.mockResolvedValue({ id: "event-9" });
  });

  it("takes named locks before FOR SHARE, conflicts and FOR UPDATE, and releases them last (D63)", async () => {
    const result = await rescheduleAdminAppointment(
      9,
      { month: "2026-04", date: "2026-04-22", timeSlot: "10:00" },
      NOW,
    );

    expect(result.timeSlot).toBe("10:00");
    expect(calls).toEqual([
      "appointment.findFirst",
      "acquireBookingLocks",
      "findMonthAvailabilityForShare",
      // D89: los conflictos de citas van antes de la limpieza de RL (ninguna ruta invierte RL -> citas).
      "lockConflictingAppointments",
      "cleanupExpiredReservationLocks",
      "findActiveAppointmentByIdInMonthForUpdate",
      "updateAppointmentScheduleById",
      "releaseBookingLocks",
    ]);
    // Las claves de los named locks usan el teléfono del dueño de la cita (D63).
    expect(acquireBookingLocksMock).toHaveBeenCalledWith({ tag: "tx" }, "2026-04-22", OWNER_PHONE);
    expect(lockConflictingAppointmentsMock).toHaveBeenCalledWith({ tag: "tx" }, "2026-04-22", OWNER_PHONE);
    // F1 (D82): timeout explícito para que la expiración no deje el GET_LOCK retenido.
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
  });

  it("does not take the FOR UPDATE row when the owner phone changed before the locks (D63)", async () => {
    findActiveAppointmentByIdInMonthForUpdateMock.mockResolvedValueOnce({
      id: 9,
      name: "Otra Persona",
      phone: "5599999999",
      date: "2026-04-22",
      timeSlot: "13:00",
      googleEventId: null,
    });

    await expect(
      rescheduleAdminAppointment(9, { month: "2026-04", date: "2026-04-22", timeSlot: "10:00" }, NOW),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");
    expect(updateAppointmentScheduleByIdMock).not.toHaveBeenCalled();
    expect(calls.at(-1)).toBe("releaseBookingLocks");
  });

  // NB-2 (D65): si GET_LOCK falla a medio tomar, el finally debe liberar lo que se haya tomado.
  it("releases the named locks when acquiring them fails (NB-2)", async () => {
    acquireBookingLocksMock.mockRejectedValueOnce(new Error("LOCK_TIMEOUT"));

    await expect(
      rescheduleAdminAppointment(9, { month: "2026-04", date: "2026-04-22", timeSlot: "10:00" }, NOW),
    ).rejects.toThrow("LOCK_TIMEOUT");
    expect(calls.at(-1)).toBe("releaseBookingLocks");
  });

  it("counts PENDING appointments as occupied in the day agenda availability (D68)", async () => {
    listBlockingAppointmentsByDateMock.mockResolvedValueOnce([{ id: 5, timeSlot: "10:00" }]);

    const agenda = await getAdminDayAgenda({ month: "2026-04", date: "2026-04-22" }, NOW);

    // Separación mínima de 240 min: con 10:00 ocupada no se ofrece 13:00, sí 14:00.
    expect(agenda.availableSlots).not.toContain("10:00");
    expect(agenda.availableSlots).toContain("14:00");
  });

  it("frees the slot of the appointment being rescheduled (PD-09, A-07, D68)", async () => {
    listBlockingAppointmentsByDateMock.mockResolvedValueOnce([{ id: 5, timeSlot: "10:00" }]);

    const agenda = await getAdminDayAgenda({ month: "2026-04", date: "2026-04-22", excludeAppointmentId: 5 }, NOW);

    expect(agenda.availableSlots).toContain("10:00");
  });
});
