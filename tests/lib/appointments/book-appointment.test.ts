import { beforeEach, describe, expect, it, vi } from "vitest";

const acquireBookingLocksMock = vi.fn(async () => undefined);
const lockConflictingAppointmentsMock = vi.fn(async () => undefined);
const releaseBookingLocksMock = vi.fn(async () => undefined);
const cleanupExpiredReservationLocksMock = vi.fn(async () => undefined);
const findReservationLockByTokenForUpdateMock = vi.fn(async () => null);
const deleteReservationLockByTokenMock = vi.fn(async () => undefined);
const syncAppointmentToCalendarMock = vi.fn(async () => ({ status: "CONFIRMED" as const }));
const buildWhatsappUrlMock = vi.fn(() => "https://wa.me/test");
const getAvailableStartSlotsMock = vi.fn(() => ["09:00", "13:00"]);
const transactionMock = vi.fn();
const findFirstMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();
const clientUpsertMock = vi.fn();
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
  },
}));

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: syncAppointmentToCalendarMock,
}));

vi.mock("@/lib/whatsapp/message", () => ({
  buildWhatsappUrl: buildWhatsappUrlMock,
}));

vi.mock("@/lib/availability/rules", () => ({
  getAvailableStartSlots: getAvailableStartSlotsMock,
}));

describe("bookAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findFirst: findFirstMock,
          findMany: findManyMock,
          create: createMock,
        },
        client: {
          upsert: clientUpsertMock,
          findUnique: clientFindUniqueMock,
        },
      }),
    );
  });

  it("creates a new appointment even when there is historical cancellation on the same slot", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
    clientUpsertMock.mockResolvedValueOnce({
      id: 21,
      name: "Bety Ruiz",
      phone: "5512345679",
    });
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
          },
        },
      },
    });
    expect(result).toEqual({
      appointmentId: 42,
      status: "CONFIRMED",
      syncReason: undefined,
      whatsappUrl: "https://wa.me/test",
    });
  });

  it("returns SLOT_NOT_AVAILABLE when the candidate time slot is blocked by active appointments", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([{ timeSlot: new Date("1970-01-01T09:00:00.000Z") }]);
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

  it("keeps successful booking flow with calendar sync and whatsapp url", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
    clientUpsertMock.mockResolvedValueOnce({
      id: 33,
      name: "Ana Lopez",
      phone: "5512345678",
    });
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
    });
    expect(result).toEqual({
      appointmentId: 77,
      status: "SYNC_FAILED",
      syncReason: "GOOGLE_UNAVAILABLE",
      whatsappUrl: "https://wa.me/test",
    });
  });

  it("confirms a booking only when a valid lock token exists", async () => {
    findReservationLockByTokenForUpdateMock.mockResolvedValueOnce({
      id: 99,
      date: "2026-03-04",
      timeSlot: "09:00",
      phone: "5512345678",
      lockToken: "lock-123",
      expiresAt: "2026-03-03T12:10:00.000Z",
    });
    findFirstMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
    clientUpsertMock.mockResolvedValueOnce({
      id: 12,
      name: "Ana Lopez",
      phone: "5512345678",
    });
    createMock.mockResolvedValueOnce({ id: 13, client: { name: "Ana Lopez" } });

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
      whatsappUrl: "https://wa.me/test",
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
    findFirstMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
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
});
