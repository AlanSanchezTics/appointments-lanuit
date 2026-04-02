import { beforeEach, describe, expect, it, vi } from "vitest";

const acquireBookingLocksMock = vi.fn(async () => undefined);
const lockConflictingAppointmentsMock = vi.fn(async () => undefined);
const releaseBookingLocksMock = vi.fn(async () => undefined);
const cleanupExpiredReservationLocksMock = vi.fn(async () => undefined);
const findReservationLockByTokenForUpdateMock = vi.fn(async () => null);
const deleteReservationLockByTokenMock = vi.fn(async () => undefined);
const syncAppointmentToCalendarMock = vi.fn(async () => ({ status: "CONFIRMED" as const }));
const createCalendarEventMock = vi.fn(async () => "google-event-1");
const deleteCalendarEventMock = vi.fn(async () => undefined);
const getWhatsappPhoneMock = vi.fn(() => "5215512345678");
const getAvailableStartSlotsMock = vi.fn(() => ["09:00", "13:00"]);
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

vi.mock("@/lib/availability/rules", () => ({
  getAvailableStartSlots: getAvailableStartSlotsMock,
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
        client: {
          create: clientCreateMock,
          aggregate: clientAggregateMock,
          findUnique: clientFindUniqueMock,
        },
      }),
    );
    findManyMock.mockResolvedValue([]);
    clientFindUniqueMock.mockResolvedValue(null);
  });

  it("creates a new appointment even when there is historical cancellation on the same slot", async () => {
    clientCreateMock.mockResolvedValueOnce({
      id: 21,
      clientNumber: 1,
      name: "Bety Ruiz",
      phone: "5512345679",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({ id: 42, client: { name: "Bety Ruiz" } });

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
  });

  it("returns SLOT_NOT_AVAILABLE when the candidate time slot is blocked by active appointments", async () => {
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ timeSlot: new Date("1970-01-01T09:00:00.000Z") }]);
    getAvailableStartSlotsMock.mockReturnValueOnce(["13:00"]);

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
  });

  it("keeps successful booking flow with calendar sync and whatsapp payload", async () => {
    clientCreateMock.mockResolvedValueOnce({
      id: 33,
      clientNumber: 1,
      name: "Ana Lopez",
      phone: "5512345678",
    });
    clientAggregateMock.mockResolvedValueOnce({ _max: { clientNumber: 0 } });
    createMock.mockResolvedValueOnce({ id: 77, client: { name: "Ana Lopez" } });
    syncAppointmentToCalendarMock.mockResolvedValueOnce({
      status: "SYNC_FAILED",
      reason: "GOOGLE_UNAVAILABLE",
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
      syncReason: "GOOGLE_UNAVAILABLE",
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

  it("rejects booking when same-month future appointments are less than 15 days apart", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        date: new Date("2026-03-18T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T13:00:00.000Z"),
      },
    ]);

    const { bookAppointment } = await import("@/lib/appointments/book-appointment");

    await expect(
      bookAppointment(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-20",
          timeSlot: "09:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).rejects.toThrow("PHONE_ALREADY_BOOKED");
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
});
