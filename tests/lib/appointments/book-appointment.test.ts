import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistedReservationLock } from "@/lib/db/appointments";
import type { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";

type SyncResult = Awaited<ReturnType<typeof syncAppointmentToCalendar>>;

// D4 BLOCK_MODE como regla de mes completo (marzo 2026): L-V, 9/10/13/14/17/18, separación 240 min, tope 3.
const MONTH_CONFIG = {
  activeMonthId: 1,
  month: "2026-03",
  slotMode: "BLOCK_MODE" as const,
  availabilityVersion: 1,
  rules: [
    {
      id: 1,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      weekdays: [1, 2, 3, 4, 5],
      times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
      minGapMinutes: 240,
      preserveCapacity: true,
      maxPerDay: 3,
    },
  ],
  exceptions: [],
};

const acquireBookingLocksMock = vi.fn(async () => undefined);
const lockConflictingAppointmentsMock = vi.fn(async () => undefined);
const releaseBookingLocksMock = vi.fn(async () => undefined);
const cleanupExpiredReservationLocksMock = vi.fn(async () => undefined);
const findReservationLockByTokenForUpdateMock = vi.fn(async () => null as PersistedReservationLock | null);
const deleteReservationLockByTokenMock = vi.fn(async () => undefined);
const syncAppointmentToCalendarMock = vi.fn(async (): Promise<SyncResult> => ({ status: "CONFIRMED" }));
const createCalendarEventMock = vi.fn(async () => "google-event-1");
const deleteCalendarEventMock = vi.fn(async () => undefined);
const getWhatsappPhoneMock = vi.fn(() => "5215512345678");
// La regla de mes cubre el mes pedido (la lectura real devuelve el mes de la fecha).
const findMonthAvailabilityForShareMock = vi.fn(async (_tx: unknown, month: string): Promise<MonthAvailabilityConfig> => ({
  ...MONTH_CONFIG,
  month,
  rules: [{ ...MONTH_CONFIG.rules[0], startDate: `${month}-01`, endDate: `${month}-31` }],
}));
const listBlockedSlotsByDateForUpdateMock = vi.fn(
  async () => [] as Array<{ id: number; date: string; timeSlot: string; reason: string; createdByAdminId: number }>,
);
const getBookableMonthConfigMock = vi.fn(async () => ({
  id: 1,
  month: "2026-03",
  status: "ACTIVE",
  slotMode: "BLOCK_MODE",
}));
const transactionMock = vi.fn();
const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const createMock = vi.fn();
const appointmentLogCreateMock = vi.fn();
const clientCreateMock = vi.fn();
const clientAggregateMock = vi.fn();
const clientFindUniqueMock = vi.fn();

vi.mock("@/lib/db/appointments", () => ({
  acquireBookingLocks: acquireBookingLocksMock,
  lockConflictingAppointments: lockConflictingAppointmentsMock,
  releaseBookingLocks: releaseBookingLocksMock,
  cleanupExpiredReservationLocks: cleanupExpiredReservationLocksMock,
  findReservationLockByTokenForUpdate: findReservationLockByTokenForUpdateMock,
  deleteReservationLockByToken: deleteReservationLockByTokenMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    appointment: {
      update: updateMock,
    },
    appointmentLog: {
      create: appointmentLogCreateMock,
    },
  },
}));

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: syncAppointmentToCalendarMock,
}));

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: createCalendarEventMock,
  deleteCalendarEvent: deleteCalendarEventMock,
}));

vi.mock("@/lib/whatsapp/message", () => ({
  getWhatsappPhone: getWhatsappPhoneMock,
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailabilityForShare: findMonthAvailabilityForShareMock,
}));
vi.mock("@/lib/db/blocked-slots", () => ({
  listBlockedSlotsByDateForUpdate: listBlockedSlotsByDateForUpdateMock,
}));

vi.mock("@/lib/active-months/service", () => ({
  getBookableMonthConfig: getBookableMonthConfigMock,
}));

describe("bookAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findMany: findManyMock,
          findFirst: findFirstMock,
          update: updateMock,
          create: createMock,
        },
        appointmentLog: {
          create: appointmentLogCreateMock,
        },
        client: {
          create: clientCreateMock,
          aggregate: clientAggregateMock,
          findUnique: clientFindUniqueMock,
        },
      }),
    );
    // Reinicia las colas de findMany: una prueba que encola valores no usados no debe contaminar la siguiente.
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
    clientFindUniqueMock.mockResolvedValue(null);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
  });

  it("creates a new appointment even when there is historical cancellation on the same slot", async () => {
    clientCreateMock.mockResolvedValueOnce({
      id: 21,
      clientNumber: 1,
      name: "Bety Ruiz",
      alias: null,
      phone: "5512345679",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({ id: 42, client: { name: "Bety Ruiz", alias: null } });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");
    const result = await bookAppointment(
      {
        name: "Bety Ruiz",
        phone: "5512345679",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(createMock).toHaveBeenCalledWith({
      data: {
        clientId: 21,
        date: new Date("2026-03-04T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T09:00:00.000Z"),
        status: "CONFIRMED",
      },
      include: {
        client: {
          select: {
            name: true,
            isLoyal: true,
          },
        },
      },
    });
    expect(result).toEqual({
      appointmentId: 42,
      status: "CONFIRMED",
      syncReason: undefined,
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Bety Ruiz",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
    });
    expect(appointmentLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appointmentId: 42,
        actionType: "CONFIRMED",
        actorType: "CLIENT",
        clientId: 21,
      }),
    });
  });

  it("returns SLOT_NOT_AVAILABLE when the candidate time slot is taken by an active appointment", async () => {
    findManyMock.mockResolvedValueOnce([{ timeSlot: new Date("1970-01-01T09:00:00.000Z") }]);

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");

    expect(createMock).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
          },
        }),
      }),
    );
  });

  it("keeps successful booking flow with calendar sync and whatsapp payload", async () => {
    clientCreateMock.mockResolvedValueOnce({
      id: 33,
      clientNumber: 1,
      name: "Ana Lopez",
      alias: null,
      phone: "5512345678",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({ id: 77, client: { name: "Ana Lopez" } });
    syncAppointmentToCalendarMock.mockResolvedValueOnce({
      status: "SYNC_FAILED",
      reason: "CALENDAR_SYNC_FAILED",
    });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");
    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(createMock).toHaveBeenCalledOnce();
    expect(syncAppointmentToCalendarMock).toHaveBeenCalledWith({
      appointmentId: 77,
      date: "2026-03-04",
      name: "Ana Lopez",
      timeSlot: "09:00",
      status: "CONFIRMED",
    });
    expect(result).toEqual({
      appointmentId: 77,
      status: "SYNC_FAILED",
      syncReason: "CALENDAR_SYNC_FAILED",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
    });
  });

  it("confirms a booking only when a valid lock token exists for a loyal client", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-04",
      timeSlot: "09:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    clientFindUniqueMock.mockResolvedValueOnce({
      id: 12,
      clientNumber: 1,
      name: "Ana Lopez",
      alias: null,
      phone: "5512345678",
      isLoyal: true,
    });
    createMock.mockResolvedValueOnce({
      id: 13,
      status: "CONFIRMED",
      client: { name: "Ana Lopez" },
    });

    const { confirmAppointmentWithLock } = await import(
      "@/lib/appointments/book-appointment"
    );
    const result = await confirmAppointmentWithLock(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
        lockToken: "lock-123",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(deleteReservationLockByTokenMock).toHaveBeenCalledWith(
      expect.any(Object),
      "lock-123",
    );
    // D89: en la confirmación, el primer bloqueo de conflictos va antes de la limpieza de RL. El segundo (dentro de
    // createAppointmentInTransaction) reusa filas que la misma transacción ya tiene bloqueadas.
    expect(lockConflictingAppointmentsMock).toHaveBeenCalled();
    expect(cleanupExpiredReservationLocksMock).toHaveBeenCalledOnce();
    expect(lockConflictingAppointmentsMock.mock.invocationCallOrder[0]).toBeLessThan(
      cleanupExpiredReservationLocksMock.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({
      appointmentId: 13,
      status: "CONFIRMED",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
    });
  });

  it("creates a pending appointment for a non-loyal client without calendar sync", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-04",
      timeSlot: "09:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    clientFindUniqueMock.mockResolvedValueOnce(null);
    clientCreateMock.mockResolvedValueOnce({
      id: 12,
      clientNumber: 1,
      name: "Ana Lopez",
      phone: "5512345678",
      isLoyal: false,
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({
      id: 14,
      status: "PENDING",
      client: { name: "Ana Lopez" },
    });

    const { confirmAppointmentWithLock } = await import(
      "@/lib/appointments/book-appointment"
    );
    const result = await confirmAppointmentWithLock(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
        lockToken: "lock-123",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(createCalendarEventMock).not.toHaveBeenCalled();
    expect(syncAppointmentToCalendarMock).not.toHaveBeenCalled();
    expect(deleteReservationLockByTokenMock).toHaveBeenCalledWith(
      expect.any(Object),
      "lock-123",
    );
    expect(result).toMatchObject({
      appointmentId: 14,
      status: "PENDING",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-04",
        timeSlot: "09:00",
      },
    });
  });

  it("accepts an existing client name when difference is only trailing whitespace", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-04",
      timeSlot: "09:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    clientFindUniqueMock.mockResolvedValueOnce({
      id: 12,
      clientNumber: 1,
      name: "Ana Lopez ",
      phone: "5512345678",
      isLoyal: true,
    });
    createMock.mockResolvedValueOnce({
      id: 15,
      status: "CONFIRMED",
      client: { name: "Ana Lopez " },
    });

    const { confirmAppointmentWithLock } = await import(
      "@/lib/appointments/book-appointment"
    );

    await expect(
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
          lockToken: "lock-123",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      appointmentId: 15,
      status: "CONFIRMED",
    });
  });

  it("rejects confirmation for a new client when name is missing", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-04",
      timeSlot: "09:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    clientFindUniqueMock.mockResolvedValueOnce(null);

    const { confirmAppointmentWithLock } = await import("@/lib/appointments/book-appointment");

    await expect(
      confirmAppointmentWithLock(
        {
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
          lockToken: "lock-123",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("NAME_REQUIRED_FOR_NEW_CLIENT");
  });

  it("allows booking when same-month future appointments are less than 15 days apart", async () => {
    findManyMock
      .mockResolvedValueOnce([
        {
          id: 70,
          date: new Date("2026-03-18T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T13:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);
    clientCreateMock.mockResolvedValueOnce({
      id: 44,
      clientNumber: 2,
      name: "Ana Lopez",
      phone: "5512345678",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 1 } });
    createMock.mockResolvedValueOnce({ id: 91, client: { name: "Ana Lopez" } });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");
    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-20",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result.appointmentId).toBe(91);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("returns SLOT_NOT_AVAILABLE when target slot is manually blocked by the rules engine", async () => {
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValueOnce([
      {
        id: 70,
        date: "2026-03-04",
        timeSlot: "09:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
  });

  it("allows booking in the same month when future appointments are 15 or more days apart", async () => {
    findManyMock
      .mockResolvedValueOnce([
        {
          id: 70,
          date: new Date("2026-03-04T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T13:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);
    clientCreateMock.mockResolvedValueOnce({
      id: 44,
      clientNumber: 2,
      name: "Ana Lopez",
      phone: "5512345678",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 1 } });
    createMock.mockResolvedValueOnce({ id: 91, client: { name: "Ana Lopez" } });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-19",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result.appointmentId).toBe(91);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("allows booking in a different month for the same phone", async () => {
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    clientCreateMock.mockResolvedValueOnce({
      id: 55,
      clientNumber: 3,
      name: "Ana Lopez",
      phone: "5512345678",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 2 } });
    createMock.mockResolvedValueOnce({ id: 88, client: { name: "Ana Lopez" } });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");
    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-04-02",
        timeSlot: "09:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(result.appointmentId).toBe(88);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("reschedules a selected appointment when appointmentIdToReschedule is provided", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-20",
      timeSlot: "13:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    findFirstMock.mockResolvedValueOnce({
      id: 21,
      date: new Date("2026-03-10T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      status: "CONFIRMED",
      googleEventId: "old-event",
      client: {
        name: "Ana Lopez",
      },
    });
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { confirmAppointmentWithLock } = await import("@/lib/appointments/book-appointment");
    const result = await confirmAppointmentWithLock(
      {
        phone: "5512345678",
        date: "2026-03-20",
        timeSlot: "13:00",
        lockToken: "lock-123",
        appointmentIdToReschedule: 21,
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(updateMock).toHaveBeenCalled();
    expect(deleteCalendarEventMock).toHaveBeenCalledWith("old-event");
    expect(createCalendarEventMock).toHaveBeenCalledWith({
      name: "Ana Lopez",
      date: "2026-03-20",
      timeSlot: "13:00",
    });
    expect(result).toMatchObject({
      appointmentId: 21,
      status: "CONFIRMED",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-20",
        timeSlot: "13:00",
      },
    });
  });

  it("returns SLOT_NOT_AVAILABLE when the day has no offered times (D46)", async () => {
    findManyMock.mockResolvedValue([]);

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    // 2026-03-07 es sábado: la regla de mes cubre L-V, así que el día no tiene horarios.
    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-07",
          timeSlot: "10:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns SLOT_NOT_AVAILABLE when the day has the full-day marker 00:00", async () => {
    findManyMock.mockResolvedValue([]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValueOnce([
      { id: 71, date: "2026-03-04", timeSlot: "00:00", reason: "DESCANSO", createdByAdminId: 1 },
    ]);

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "10:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts a time that the rules offer on a day opened by an exception", async () => {
    findMonthAvailabilityForShareMock.mockResolvedValueOnce({
      ...MONTH_CONFIG,
      exceptions: [
        { id: 9, date: "2026-03-07", times: ["11:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 3 },
      ],
    });
    findManyMock.mockResolvedValue([]);
    clientCreateMock.mockResolvedValueOnce({ id: 3, clientNumber: 1, name: "Ana Lopez", alias: null, phone: "5512345678" });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({ id: 55, client: { name: "Ana Lopez", alias: null } });

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");
    const result = await bookAppointment(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-07",
        timeSlot: "11:00",
      },
      new Date("2026-03-03T12:00:00.000Z"),
    );

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ timeSlot: new Date("1970-01-01T11:00:00.000Z") }),
    }));
    expect(result).toMatchObject({ appointmentId: 55 });
  });
});
