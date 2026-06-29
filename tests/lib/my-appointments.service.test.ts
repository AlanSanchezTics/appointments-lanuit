import { beforeEach, describe, expect, it, vi } from "vitest";

const appointmentFindManyMock = vi.fn();
const appointmentUpdateManyMock = vi.fn();
const appointmentUpdateMock = vi.fn();
const queryRawMock = vi.fn();
const transactionMock = vi.fn();
const calendarDeleteMock = vi.fn();
const calendarCreateMock = vi.fn();
const calendarUpdateMock = vi.fn();
const appointmentLogCreateMock = vi.fn();
const appointmentLogCreateManyMock = vi.fn();
const getBookableMonthConfigMock = vi.fn();
const listBlockedSlotsByDateForUpdateMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findMany: appointmentFindManyMock,
      update: appointmentUpdateMock,
      updateMany: appointmentUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/calendar/google", () => ({
  deleteCalendarEvent: calendarDeleteMock,
  createCalendarEvent: calendarCreateMock,
  updateCalendarEvent: calendarUpdateMock,
}));

vi.mock("@/lib/active-months/service", () => ({
  getBookableMonthConfig: getBookableMonthConfigMock,
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listBlockedSlotsByDateForUpdate: listBlockedSlotsByDateForUpdateMock,
}));

vi.mock("@/lib/admin/appointment-logs/service", () => ({
  createAppointmentLogEvent: appointmentLogCreateMock,
  createAppointmentLogEvents: appointmentLogCreateManyMock,
}));

vi.mock("@/lib/availability/month-slot-mode", () => ({
  resolveBaseSlotsByMonthMode: vi.fn(() => ["09:00", "10:00", "14:00"]),
}));

vi.mock("@/lib/availability/rules", () => ({
  getAvailableStartSlotsWithManualBlocks: vi.fn((baseSlots: string[]) => baseSlots),
}));

vi.mock("@/lib/admin/blocked-spaces/day-block", () => ({
  splitBlockedTimeSlots: vi.fn(() => ({
    hasFullDayBlock: false,
    blockedSlots: new Set<string>(),
  })),
}));

describe("my appointments service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointmentLogCreateMock.mockResolvedValue(undefined);
    appointmentLogCreateManyMock.mockResolvedValue({ count: 0 });
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
    getBookableMonthConfigMock.mockResolvedValue({
      slotMode: "SECOND_ONLY_MODE",
    });

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findMany: appointmentFindManyMock,
          update: appointmentUpdateMock,
          updateMany: appointmentUpdateManyMock,
        },
        $queryRaw: queryRawMock,
      }),
    );
  });

  it("returns blocked future appointments alongside actionable ones", async () => {
    appointmentFindManyMock.mockResolvedValueOnce([
      {
        id: 1,
        date: new Date("2026-07-21T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
        status: "CONFIRMED",
        client: {
          name: "Ana Lopez",
          phone: "5512345678",
        },
      },
      {
        id: 2,
        date: new Date("2026-07-20T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T11:00:00.000Z"),
        status: "PENDING",
        client: {
          name: "Ana Lopez",
          phone: "5512345678",
        },
      },
    ]);

    const { findMyAppointments } = await import("@/lib/my-appointments/service");
    const result = await findMyAppointments(
      {
        phone: "5512345678",
      },
      new Date("2026-07-20T09:00:00.000Z"),
    );

    expect(result.appointments).toEqual([
      {
        appointmentId: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-07-21",
        timeSlot: "10:00",
        status: "CONFIRMED",
        canCancel: true,
        canModify: true,
        isBlocked: false,
      },
      {
        appointmentId: 2,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-07-20",
        timeSlot: "11:00",
        status: "PENDING",
        canCancel: false,
        canModify: false,
        isBlocked: true,
        blockedReason: "PUBLIC_ACTIONS_UNAVAILABLE",
      },
    ]);
  });

  it("reschedules a pending appointment without Google sync", async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        id: 7,
        client_id: 33,
        name: "Ana Lopez",
        phone: "5512345678",
        date: new Date("2026-07-20T00:00:00.000Z"),
        time_slot: new Date("1970-01-01T14:00:00.000Z"),
        status: "PENDING",
        google_event_id: null,
      },
    ]);
    appointmentFindManyMock.mockResolvedValueOnce([]);

    const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
    const result = await rescheduleMyAppointment(
      {
        phone: "5512345678",
        appointmentId: 7,
        month: "2026-07",
        date: "2026-07-21",
        timeSlot: "14:00",
      },
      new Date("2026-07-20T09:00:00.000Z"),
    );

    expect(result).toEqual({
        appointmentId: 7,
        status: "PENDING",
        googleEventId: null,
      });
    expect(calendarCreateMock).not.toHaveBeenCalled();
    expect(calendarUpdateMock).not.toHaveBeenCalled();
    expect(appointmentUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 7,
      },
      data: {
        date: new Date("2026-07-21T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T14:00:00.000Z"),
        googleEventId: null,
      },
    });
  });
});
