import { beforeEach, describe, expect, it, vi } from "vitest";

import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";

const acquireBookingLocksMock = vi.fn(async () => undefined);
const cleanupExpiredReservationLocksMock = vi.fn(async () => undefined);
const lockConflictingAppointmentsMock = vi.fn(async () => undefined);
const releaseBookingLocksMock = vi.fn(async () => undefined);
const listActiveReservationLocksForDateMock = vi.fn(async () => []);
const deleteActiveReservationLocksByPhoneMock = vi.fn(async () => undefined);
const createReservationLockMock = vi.fn(async () => ({
  id: 1,
  date: "2026-03-14",
  timeSlot: "09:00",
  phone: "5512345678",
  lockToken: "lock-123",
  expiresAt: "2026-03-13T12:10:00.000Z",
}));
const getBookableMonthConfigMock = vi.fn(async () => ({
  id: 1,
  month: "2026-03",
  status: "ACTIVE",
  slotMode: "BLOCK_MODE",
}));
const listBlockedSlotsByDateForUpdateMock = vi.fn(async () => []);

const transactionMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueClientMock = vi.fn();
const releaseDeleteManyMock = vi.fn();

vi.mock("@/lib/db/appointments", () => ({
  acquireBookingLocks: acquireBookingLocksMock,
  cleanupExpiredReservationLocks: cleanupExpiredReservationLocksMock,
  lockConflictingAppointments: lockConflictingAppointmentsMock,
  releaseBookingLocks: releaseBookingLocksMock,
  listActiveReservationLocksForDate: listActiveReservationLocksForDateMock,
  deleteActiveReservationLocksByPhone: deleteActiveReservationLocksByPhoneMock,
  createReservationLock: createReservationLockMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    reservationLock: {
      deleteMany: releaseDeleteManyMock,
    },
  },
}));

vi.mock("@/lib/active-months/service", () => ({
  getBookableMonthConfig: getBookableMonthConfigMock,
}));
vi.mock("@/lib/db/blocked-slots", () => ({
  listBlockedSlotsByDateForUpdate: listBlockedSlotsByDateForUpdateMock,
}));
vi.mock("@/lib/whatsapp/message", () => ({
  getWhatsappPhone: vi.fn(() => "5215512345678"),
}));

describe("reservation slot locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findMany: findManyMock,
        },
        client: {
          findUnique: findUniqueClientMock,
        },
      }),
    );
    findManyMock.mockResolvedValue([]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
  });

  it("acquires a lock for an available slot", async () => {
    findUniqueClientMock.mockResolvedValueOnce(null);

    const { acquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");
    const result = await acquireReservationSlotLock(
      {
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-16",
        timeSlot: "09:00",
      },
      new Date("2026-03-13T12:00:00.000Z"),
    );

    expect(result.lockToken).toBe("lock-123");
    expect(result.expiresAt).toBe("2026-03-13T12:10:00.000Z");
    expect(createReservationLockMock).toHaveBeenCalledOnce();
    expect(findManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
          },
        }),
      }),
    );
  });

  it("rejects lock acquisition when slot is already locked", async () => {
    findUniqueClientMock.mockResolvedValueOnce(null);
    listActiveReservationLocksForDateMock.mockResolvedValueOnce([
      {
      id: 2,
      date: "2026-03-16",
      timeSlot: "09:00",
      phone: "5511111111",
      lockToken: "other-lock",
      expiresAt: "2026-03-13T12:09:00.000Z",
      },
    ]);

    const { acquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    await expect(
      acquireReservationSlotLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "09:00",
        },
        new Date("2026-03-13T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_LOCKED");
  });

  it("rejects incompatible lock by directional rule even when exact slot differs", async () => {
    findUniqueClientMock.mockResolvedValueOnce(null);
    listActiveReservationLocksForDateMock.mockResolvedValueOnce([
      {
        id: 2,
        date: "2026-03-16",
        timeSlot: "17:00",
        phone: "5511111111",
        lockToken: "other-lock",
        expiresAt: "2026-03-13T12:09:00.000Z",
      },
    ]);

    const { acquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    await expect(
      acquireReservationSlotLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "14:00",
        },
        new Date("2026-03-13T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
  });

  it("releases lock by token", async () => {
    releaseDeleteManyMock.mockResolvedValueOnce({ count: 1 });

    const { releaseReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");
    const result = await releaseReservationSlotLock({ lockToken: "lock-123" });

    expect(result).toEqual({ released: true });
  });

  it("returns client existence metadata in check+lock flow", async () => {
    findUniqueClientMock.mockResolvedValueOnce({
      id: 9,
      name: "Ana Lopez",
    });
    const { checkClientAndAcquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");
    const result = await checkClientAndAcquireReservationSlotLock(
      {
        phone: "5512345678",
        date: "2026-03-16",
        timeSlot: "09:00",
      },
      new Date("2026-03-13T12:00:00.000Z"),
    );

    expect(result).toEqual({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
      futureAppointmentsInMonth: [],
      canBookAsNewAppointment: false,
      whatsappPhone: "5215512345678",
      clientExists: true,
      clientName: "Ana Lopez",
    });
  });

  it("returns future appointments in month when same phone already has active bookings", async () => {
    findUniqueClientMock.mockResolvedValueOnce({
      id: 9,
      name: "Ana Lopez",
    });
    findManyMock.mockResolvedValueOnce([
      {
        id: 77,
        date: new Date("2026-03-18T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      },
    ]);

    const { checkClientAndAcquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    const result = await checkClientAndAcquireReservationSlotLock(
      {
        phone: "5512345678",
        date: "2026-03-20",
        timeSlot: "13:00",
      },
      new Date("2026-03-13T12:00:00.000Z"),
    );

    expect(result).toEqual({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Lopez",
      canBookAsNewAppointment: true,
      whatsappPhone: "5215512345678",
      futureAppointmentsInMonth: [
        {
          appointmentId: 77,
          date: "2026-03-18",
          timeSlot: "10:00",
        },
      ],
    });
  });

  it("does not return suggestion options when same-month appointments keep a 15-day gap", async () => {
    findUniqueClientMock.mockResolvedValueOnce({
      id: 9,
      name: "Ana Lopez",
    });
    findManyMock.mockResolvedValueOnce([
      {
        id: 88,
        date: new Date("2026-03-01T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      },
    ]);

    const { checkClientAndAcquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    const result = await checkClientAndAcquireReservationSlotLock(
      {
        phone: "5512345678",
        date: "2026-03-16",
        timeSlot: "13:00",
      },
      new Date("2026-02-27T12:00:00.000Z"),
    );

    expect(result.futureAppointmentsInMonth).toHaveLength(0);
    expect(result.canBookAsNewAppointment).toBe(false);
    expect(result.whatsappPhone).toBe("5215512345678");
  });

  it("allows lock when future appointment exists in a different month", async () => {
    findUniqueClientMock.mockResolvedValueOnce({
      id: 9,
      name: "Ana Lopez",
    });
    findManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { checkClientAndAcquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");
    const result = await checkClientAndAcquireReservationSlotLock(
      {
        phone: "5512345678",
        date: "2026-04-02",
        timeSlot: "09:00",
      },
      new Date("2026-03-13T12:00:00.000Z"),
    );

    expect(result.lockToken).toBe("lock-123");
    expect(result).toEqual({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Lopez",
      futureAppointmentsInMonth: [],
      canBookAsNewAppointment: false,
      whatsappPhone: "5215512345678",
    });
  });

  it("rejects lock acquisition when slot is manually blocked", async () => {
    findUniqueClientMock.mockResolvedValueOnce(null);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValueOnce([
      {
        id: 60,
        date: "2026-03-16",
        timeSlot: "10:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const { acquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    await expect(
      acquireReservationSlotLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "10:00",
        },
        new Date("2026-03-13T12:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
  });

  it("keeps 10:00 available in SECOND_ONLY_MODE with lock at 18:00 and manual block at 14:00", async () => {
    getBookableMonthConfigMock.mockResolvedValueOnce({
      id: 1,
      month: "2026-03",
      status: "ACTIVE",
      slotMode: "SECOND_ONLY_MODE",
    });
    findUniqueClientMock.mockResolvedValueOnce(null);
    listActiveReservationLocksForDateMock.mockResolvedValueOnce([
      {
        id: 2,
        date: "2026-03-16",
        timeSlot: "18:00",
        phone: "5511111111",
        lockToken: "other-lock",
        expiresAt: "2026-03-13T12:09:00.000Z",
      },
    ]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValueOnce([
      {
        id: 61,
        date: "2026-03-16",
        timeSlot: "14:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const { acquireReservationSlotLock } = await import("@/lib/appointments/lock-reservation-slot");

    await expect(
      acquireReservationSlotLock(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-16",
          timeSlot: "10:00",
        },
        new Date("2026-03-13T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      lockToken: "lock-123",
    });
  });
});
