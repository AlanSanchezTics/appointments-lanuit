import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAdminBlockedSlots,
  deleteAdminBlockedSlot,
  getAdminBlockableSlots,
  updateAdminBlockedSlot,
} from "@/lib/admin/blocked-spaces/service";

const {
  transactionMock,
  findRegisteredMonthMock,
  cleanupExpiredReservationLocksMock,
  lockConflictingAppointmentsMock,
  listActiveReservationLocksForDateMock,
  listMonthActiveReservationLocksMock,
  listMonthAppointmentsMock,
  listActiveAppointmentSlotsByDateForUpdateMock,
  listBlockedSlotsByDateForUpdateMock,
  listMonthBlockedSlotsMock,
  createBlockedSlotsMock,
  countBlockedSlotsByGoogleEventIdMock,
  deleteBlockedSlotsByDateMock,
  findBlockedSlotByIdForUpdateMock,
  updateBlockedSlotReasonByIdMock,
  deleteBlockedSlotByIdMock,
  syncBlockedSlotCreateMock,
  syncBlockedSlotUpdateMock,
  syncBlockedSlotDeleteMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findRegisteredMonthMock: vi.fn(),
  cleanupExpiredReservationLocksMock: vi.fn(),
  lockConflictingAppointmentsMock: vi.fn(),
  listActiveReservationLocksForDateMock: vi.fn(),
  listMonthActiveReservationLocksMock: vi.fn(),
  listMonthAppointmentsMock: vi.fn(),
  listActiveAppointmentSlotsByDateForUpdateMock: vi.fn(),
  listBlockedSlotsByDateForUpdateMock: vi.fn(),
  listMonthBlockedSlotsMock: vi.fn(),
  createBlockedSlotsMock: vi.fn(),
  countBlockedSlotsByGoogleEventIdMock: vi.fn(),
  deleteBlockedSlotsByDateMock: vi.fn(),
  findBlockedSlotByIdForUpdateMock: vi.fn(),
  updateBlockedSlotReasonByIdMock: vi.fn(),
  deleteBlockedSlotByIdMock: vi.fn(),
  syncBlockedSlotCreateMock: vi.fn(),
  syncBlockedSlotUpdateMock: vi.fn(),
  syncBlockedSlotDeleteMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: findRegisteredMonthMock,
}));

vi.mock("@/lib/db/appointments", () => ({
  cleanupExpiredReservationLocks: cleanupExpiredReservationLocksMock,
  lockConflictingAppointments: lockConflictingAppointmentsMock,
  listActiveReservationLocksForDate: listActiveReservationLocksForDateMock,
  listMonthActiveReservationLocks: listMonthActiveReservationLocksMock,
  listMonthAppointments: listMonthAppointmentsMock,
}));

vi.mock("@/lib/db/admin-appointments", () => ({
  listActiveAppointmentSlotsByDateForUpdate: listActiveAppointmentSlotsByDateForUpdateMock,
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  createBlockedSlots: createBlockedSlotsMock,
  countBlockedSlotsByGoogleEventId: countBlockedSlotsByGoogleEventIdMock,
  deleteBlockedSlotsByDate: deleteBlockedSlotsByDateMock,
  deleteBlockedSlotById: deleteBlockedSlotByIdMock,
  findBlockedSlotByIdForUpdate: findBlockedSlotByIdForUpdateMock,
  listBlockedSlotsByDateForUpdate: listBlockedSlotsByDateForUpdateMock,
  listMonthBlockedSlots: listMonthBlockedSlotsMock,
  updateBlockedSlotReasonById: updateBlockedSlotReasonByIdMock,
}));

vi.mock("@/lib/calendar/sync-blocked-slot", () => ({
  syncBlockedSlotCreate: syncBlockedSlotCreateMock,
  syncBlockedSlotUpdate: syncBlockedSlotUpdateMock,
  syncBlockedSlotDelete: syncBlockedSlotDeleteMock,
}));

describe("admin blocked spaces service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({}),
    );

    findRegisteredMonthMock.mockResolvedValue({
      month: "2026-04",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });

    cleanupExpiredReservationLocksMock.mockResolvedValue(undefined);
    lockConflictingAppointmentsMock.mockResolvedValue(undefined);
    listActiveAppointmentSlotsByDateForUpdateMock.mockResolvedValue([]);
    listActiveReservationLocksForDateMock.mockResolvedValue([]);
    listMonthAppointmentsMock.mockResolvedValue([]);
    listMonthActiveReservationLocksMock.mockResolvedValue([]);
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
    listMonthBlockedSlotsMock.mockResolvedValue([]);
    createBlockedSlotsMock.mockResolvedValue([
      {
        id: 31,
        date: "2026-04-22",
        timeSlot: "13:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
        createdByAdminId: 7,
      },
    ]);
    syncBlockedSlotCreateMock.mockResolvedValue({ status: "CONFIRMED" });
    syncBlockedSlotUpdateMock.mockResolvedValue({ status: "CONFIRMED" });
    syncBlockedSlotDeleteMock.mockResolvedValue({ status: "CONFIRMED" });
    countBlockedSlotsByGoogleEventIdMock.mockResolvedValue(0);
  });

  it("syncs blocked slot creation with calendar", async () => {
    const result = await createAdminBlockedSlots(
      {
        month: "2026-04",
        date: "2026-04-22",
        fullDay: false,
        slots: ["13:00"],
        reason: "DESCANSO",
        createdByAdminId: 7,
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    expect(syncBlockedSlotCreateMock).toHaveBeenCalledWith({
      blockedSlotId: 31,
      date: "2026-04-22",
      timeSlot: "13:00",
      reason: "DESCANSO",
      durationHours: 1,
    });
    expect(result.syncSummary).toEqual({ total: 1, synced: 1, failed: 0 });
    expect(result.syncWarnings).toEqual([]);
  });

  it("keeps local block and returns warning when calendar sync fails", async () => {
    syncBlockedSlotCreateMock.mockResolvedValueOnce({
      status: "SYNC_FAILED",
      reason: "CALENDAR_SYNC_FAILED",
    });

    const result = await createAdminBlockedSlots(
      {
        month: "2026-04",
        date: "2026-04-22",
        fullDay: false,
        slots: ["13:00"],
        reason: "DESCANSO",
        createdByAdminId: 7,
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    expect(result.syncSummary).toEqual({ total: 1, synced: 0, failed: 1 });
    expect(result.syncWarnings).toEqual([
      {
        blockedSlotId: 31,
        reason: "CALENDAR_SYNC_FAILED",
      },
    ]);
  });

  it("keeps current calendar duration behavior in SECOND_ONLY_MODE", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-04",
      status: "ACTIVE",
      slotMode: "SECOND_ONLY_MODE",
    });

    await createAdminBlockedSlots(
      {
        month: "2026-04",
        date: "2026-04-22",
        fullDay: false,
        slots: ["14:00"],
        reason: "DESCANSO",
        createdByAdminId: 7,
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    expect(syncBlockedSlotCreateMock).toHaveBeenCalledWith({
      blockedSlotId: 31,
      date: "2026-04-22",
      timeSlot: "13:00",
      reason: "DESCANSO",
      durationHours: undefined,
    });
  });

  it("creates one calendar event per hour when a full block pair is selected in BLOCK_MODE", async () => {
    createBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 41,
        date: "2026-04-22",
        timeSlot: "09:00",
        reason: "OTRO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
        createdByAdminId: 7,
      },
      {
        id: 42,
        date: "2026-04-22",
        timeSlot: "10:00",
        reason: "OTRO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
        createdByAdminId: 7,
      },
    ]);
    syncBlockedSlotCreateMock.mockResolvedValueOnce({
      status: "CONFIRMED",
    });
    syncBlockedSlotCreateMock.mockResolvedValueOnce({
      status: "CONFIRMED",
    });

    const result = await createAdminBlockedSlots(
      {
        month: "2026-04",
        date: "2026-04-22",
        fullDay: false,
        slots: ["09:00", "10:00"],
        reason: "OTRO",
        createdByAdminId: 7,
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    expect(syncBlockedSlotCreateMock).toHaveBeenCalledTimes(2);
    expect(syncBlockedSlotCreateMock).toHaveBeenNthCalledWith(1, {
      blockedSlotId: 41,
      date: "2026-04-22",
      timeSlot: "09:00",
      reason: "OTRO",
      durationHours: 1,
    });
    expect(syncBlockedSlotCreateMock).toHaveBeenNthCalledWith(2, {
      blockedSlotId: 42,
      date: "2026-04-22",
      timeSlot: "10:00",
      reason: "OTRO",
      durationHours: 1,
    });
    expect(result.syncSummary).toEqual({ total: 2, synced: 2, failed: 0 });
  });

  it("syncs blocked slot reason update", async () => {
    findBlockedSlotByIdForUpdateMock.mockResolvedValueOnce({
      id: 31,
      date: "2026-04-22",
      timeSlot: "13:00",
      reason: "DESCANSO",
      googleEventId: "event-31",
      calendarSyncStatus: "CONFIRMED",
      calendarSyncReason: null,
      createdByAdminId: 7,
    });

    const result = await updateAdminBlockedSlot(
      {
        month: "2026-04",
        blockedSlotId: 31,
        reason: "OTRO",
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    expect(syncBlockedSlotUpdateMock).toHaveBeenCalledWith({
      blockedSlotId: 31,
      date: "2026-04-22",
      timeSlot: "13:00",
      reason: "OTRO",
      googleEventId: "event-31",
    });
    expect(result.syncSummary).toEqual({ total: 1, synced: 1, failed: 0 });
    expect(result.syncWarnings).toEqual([]);
  });

  it("deletes local blocked slot even when calendar delete fails", async () => {
    findBlockedSlotByIdForUpdateMock.mockResolvedValueOnce({
      id: 31,
      date: "2026-04-22",
      timeSlot: "13:00",
      reason: "DESCANSO",
      googleEventId: "event-31",
      calendarSyncStatus: "CONFIRMED",
      calendarSyncReason: null,
      createdByAdminId: 7,
    });
    syncBlockedSlotDeleteMock.mockResolvedValueOnce({
      status: "SYNC_FAILED",
      reason: "CALENDAR_DELETE_FAILED",
    });

    const result = await deleteAdminBlockedSlot({
      month: "2026-04",
      blockedSlotId: 31,
    });

    expect(deleteBlockedSlotByIdMock).toHaveBeenCalled();
    expect(result.status).toBe("DELETED");
    expect(result.syncSummary).toEqual({ total: 1, synced: 0, failed: 1 });
    expect(result.syncWarnings).toEqual([
      {
        blockedSlotId: 31,
        reason: "CALENDAR_DELETE_FAILED",
      },
    ]);
  });

  it("keeps 10:00 blockable in SECOND_ONLY_MODE when 18:00 is occupied and 14:00 is manually blocked", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-04",
      status: "ACTIVE",
      slotMode: "SECOND_ONLY_MODE",
    });
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 81,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-04-22",
        timeSlot: "18:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
    ]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 82,
        date: "2026-04-22",
        timeSlot: "14:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const result = await getAdminBlockableSlots(
      {
        month: "2026-04",
      },
      new Date("2026-04-10T15:00:00.000Z"),
    );

    const day = result.days.find((entry) => entry.date === "2026-04-22");
    expect(day?.slots).toEqual(["10:00"]);
  });
});
