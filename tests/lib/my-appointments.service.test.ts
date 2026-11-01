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

const acquireBookingLocksMock = vi.fn(async () => undefined);
const lockConflictingAppointmentsMock = vi.fn(async () => undefined);
const releaseBookingLocksMock = vi.fn(async () => undefined);

// La lectura de locks vigentes (findActiveReservationLockForSlotForUpdate) es real: pasa por tx.$queryRaw (queryRawMock).
vi.mock("@/lib/db/appointments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/appointments")>()),
  acquireBookingLocks: acquireBookingLocksMock,
  lockConflictingAppointments: lockConflictingAppointmentsMock,
  releaseBookingLocks: releaseBookingLocksMock,
}));

vi.mock("@/lib/admin/appointment-logs/service", () => ({
  createAppointmentLogEvent: appointmentLogCreateMock,
  createAppointmentLogEvents: appointmentLogCreateManyMock,
}));

// D4 SECOND_ONLY_MODE como regla de mes completo: L-V, 10/14/18. La regla cubre el mes pedido, como la lectura real.
const findMonthAvailabilityForShareMock = vi.fn(async (_tx: unknown, month: string) => ({
  activeMonthId: 1,
  month,
  availabilityVersion: 1,
  rules: [
    {
      id: 2,
      startDate: `${month}-01`,
      endDate: `${month}-31`,
      weekdays: [1, 2, 3, 4, 5],
      times: ["10:00", "14:00", "18:00"],
      minGapMinutes: 0,
      preserveCapacity: false,
      maxPerDay: 3,
    },
  ],
  exceptions: [],
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailabilityForShare: findMonthAvailabilityForShareMock,
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
    // Sin locks por defecto: las lecturas de tx.$queryRaw devuelven [] salvo que el test encole otra respuesta.
    queryRawMock.mockReset();
    queryRawMock.mockResolvedValue([]);
    // Los tests que fallan antes de validar el destino no consumen su respuesta encolada; se limpia la cola.
    appointmentFindManyMock.mockReset();
    appointmentLogCreateMock.mockResolvedValue(undefined);
    appointmentLogCreateManyMock.mockResolvedValue({ count: 0 });
    listBlockedSlotsByDateForUpdateMock.mockResolvedValue([]);
    getBookableMonthConfigMock.mockResolvedValue({
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

  it("rejects rescheduling to a day without offered times (D46)", async () => {
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

    // 2026-07-25 es sábado: la regla cubre L-V, así que el día no tiene horarios.
    await expect(
      rescheduleMyAppointment(
        {
          phone: "5512345678",
          appointmentId: 7,
          month: "2026-07",
          date: "2026-07-25",
          timeSlot: "14:00",
        },
        new Date("2026-07-20T09:00:00.000Z"),
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
    expect(appointmentUpdateMock).not.toHaveBeenCalled();
  });

  it("takes booking locks, then FOR SHARE rules, conflict locks and the appointment row, and releases the locks (PD-08)", async () => {
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
    await rescheduleMyAppointment(
      {
        phone: "5512345678",
        appointmentId: 7,
        month: "2026-07",
        date: "2026-07-21",
        timeSlot: "14:00",
      },
      new Date("2026-07-20T09:00:00.000Z"),
    );

    expect(acquireBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    // F1 (D82): timeout explícito de la transacción de reagendado público.
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    const acquireOrder = acquireBookingLocksMock.mock.invocationCallOrder[0];
    expect(acquireOrder).toBeLessThan(findMonthAvailabilityForShareMock.mock.invocationCallOrder[0]);
    expect(findMonthAvailabilityForShareMock.mock.invocationCallOrder[0]).toBeLessThan(
      lockConflictingAppointmentsMock.mock.invocationCallOrder[0],
    );
    expect(lockConflictingAppointmentsMock.mock.invocationCallOrder[0]).toBeLessThan(
      queryRawMock.mock.invocationCallOrder[0],
    );
  });

  it("releases the booking locks when the reschedule fails", async () => {
    queryRawMock.mockResolvedValueOnce([]);

    const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
    await expect(
      rescheduleMyAppointment(
        {
          phone: "5512345678",
          appointmentId: 7,
          month: "2026-07",
          date: "2026-07-21",
          timeSlot: "14:00",
        },
        new Date("2026-07-20T09:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");

    expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    expect(appointmentUpdateMock).not.toHaveBeenCalled();
  });

  it("releases the booking locks when the conflict lock fails", async () => {
    lockConflictingAppointmentsMock.mockRejectedValueOnce(new Error("LOCK_TIMEOUT"));

    const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
    await expect(
      rescheduleMyAppointment(
        {
          phone: "5512345678",
          appointmentId: 7,
          month: "2026-07",
          date: "2026-07-21",
          timeSlot: "14:00",
        },
        new Date("2026-07-20T09:00:00.000Z"),
      ),
    ).rejects.toThrow("LOCK_TIMEOUT");

    expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(appointmentUpdateMock).not.toHaveBeenCalled();
  });

  // NB-5 (D78): un error de FOR SHARE no se convierte en SLOT_NOT_AVAILABLE; se propaga y los locks se liberan.
  it("propagates a FOR SHARE failure instead of reporting the slot as unavailable (NB-5)", async () => {
    findMonthAvailabilityForShareMock.mockRejectedValueOnce(new Error("Lock wait timeout exceeded"));

    const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
    await expect(
      rescheduleMyAppointment(
        {
          phone: "5512345678",
          appointmentId: 7,
          month: "2026-07",
          date: "2026-07-21",
          timeSlot: "14:00",
        },
        new Date("2026-07-20T09:00:00.000Z"),
      ),
    ).rejects.toThrow("Lock wait timeout exceeded");

    expect(lockConflictingAppointmentsMock).not.toHaveBeenCalled();
    expect(appointmentUpdateMock).not.toHaveBeenCalled();
    expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
  });

  it("rejects an impossible calendar date as VALIDATION_ERROR before opening the transaction (B2)", async () => {
    const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
    const { normalizeErrorCode } = await import("@/lib/api/error-response");

    const error = await rescheduleMyAppointment(
      {
        phone: "5512345678",
        appointmentId: 7,
        month: "2026-02",
        date: "2026-02-30",
        timeSlot: "14:00",
      },
      new Date("2026-02-01T09:00:00.000Z"),
    ).catch((caught: unknown) => caught);

    expect(normalizeErrorCode(error)).toBe("VALIDATION_ERROR");
    expect(transactionMock).not.toHaveBeenCalled();
    expect(acquireBookingLocksMock).not.toHaveBeenCalled();
  });

  // D87: la reprogramación pública respeta los reservation_locks vigentes de otras clientas, como la creación admin.
  describe("reservation locks at the destination (D87)", () => {
    const LOCK_NOW = new Date("2026-07-20T09:00:00.000Z");
    const TEN_MINUTES = 10 * 60 * 1000;
    const appointmentRow = {
      id: 7,
      client_id: 33,
      name: "Ana Lopez",
      phone: "5512345678",
      date: new Date("2026-07-20T00:00:00.000Z"),
      time_slot: new Date("1970-01-01T14:00:00.000Z"),
      status: "PENDING",
      google_event_id: null,
    };
    const lockRow = (phone: string, expiresAt: Date) => ({
      id: 1,
      date: new Date("2026-07-21T00:00:00.000Z"),
      time_slot: new Date("1970-01-01T10:00:00.000Z"),
      phone,
      lock_token: "lock-token-1",
      expires_at: expiresAt,
    });
    const request = {
      phone: "5512345678",
      appointmentId: 7,
      month: "2026-07",
      date: "2026-07-21",
      timeSlot: "10:00",
    };

    it("rejects a destination held by another client's active lock", async () => {
      queryRawMock
        .mockResolvedValueOnce([appointmentRow])
        .mockResolvedValueOnce([lockRow("5598765432", new Date(LOCK_NOW.getTime() + TEN_MINUTES))]);
      appointmentFindManyMock.mockResolvedValueOnce([]);

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      await expect(rescheduleMyAppointment(request, LOCK_NOW)).rejects.toThrow("SLOT_NOT_AVAILABLE");

      // La lectura de locks va después de los conflictos de fila y usa la fecha, la hora y el "ahora" del servicio.
      expect(lockConflictingAppointmentsMock.mock.invocationCallOrder[0]).toBeLessThan(
        queryRawMock.mock.invocationCallOrder[1],
      );
      // Argumentos de la plantilla: fecha, hora, ahora y teléfono propio (el filtro "phone <>" va en SQL).
      expect(queryRawMock.mock.calls[1]?.slice(1)).toEqual(["2026-07-21", "10:00", LOCK_NOW, "5512345678"]);
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
      expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    });

    it("does not block on the same client's own lock (the SQL excludes the client's phone)", async () => {
      // El mock devuelve lo que devolvería la consulta con "phone <> propio": ningún lock de otra clienta.
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      appointmentFindManyMock.mockResolvedValueOnce([]);

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const result = await rescheduleMyAppointment(request, LOCK_NOW);

      const lockSql = (queryRawMock.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(lockSql).toContain("phone <>");
      expect(result).toEqual({ appointmentId: 7, status: "PENDING", googleEventId: null });
      expect(appointmentUpdateMock).toHaveBeenCalledTimes(1);
    });

    it("filters expired locks in the lookup, so an expired lock does not come back as a blocker", async () => {
      // La caducidad se aplica en SQL (expires_at > now); aquí se afirma el predicado y que, sin filas vigentes, se reprograma.
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      appointmentFindManyMock.mockResolvedValueOnce([]);

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const result = await rescheduleMyAppointment(request, LOCK_NOW);

      const lockSql = (queryRawMock.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(lockSql).toContain("expires_at >");
      expect(lockSql).toContain("FOR UPDATE");
      expect(result.status).toBe("PENDING");
      expect(appointmentUpdateMock).toHaveBeenCalledTimes(1);
    });

    // B2 / D88: un deadlock o timeout al leer locks llega como error de transacción, no como SLOT_NOT_AVAILABLE (D81).
    it("propagates a transaction error from the lock read instead of reporting SLOT_NOT_AVAILABLE", async () => {
      queryRawMock
        .mockResolvedValueOnce([appointmentRow])
        .mockRejectedValueOnce(new Error("Deadlock found when trying to get lock; try restarting transaction"));
      appointmentFindManyMock.mockResolvedValueOnce([]);

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const error = await rescheduleMyAppointment(request, LOCK_NOW).catch((caught: unknown) => caught);

      expect((error as Error).message).toContain("Deadlock found");
      expect((error as Error).message).not.toBe("SLOT_NOT_AVAILABLE");
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
      expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    });

    // BLK-2 (D81/D88): un deadlock en las lecturas de ocupación de la reprogramación se propaga como error de transacción.
    const DEADLOCK = "Deadlock found when trying to get lock; try restarting transaction";

    it("propagates a deadlock from the occupied-appointments read instead of reporting SLOT_NOT_AVAILABLE", async () => {
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      appointmentFindManyMock.mockRejectedValueOnce(new Error(DEADLOCK));

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const error = await rescheduleMyAppointment(request, LOCK_NOW).catch((caught: unknown) => caught);

      expect((error as Error).message).toBe(DEADLOCK);
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
      expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    });

    it("propagates a deadlock from the blocked-slots read instead of reporting SLOT_NOT_AVAILABLE", async () => {
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      appointmentFindManyMock.mockResolvedValueOnce([]);
      listBlockedSlotsByDateForUpdateMock.mockRejectedValueOnce(new Error(DEADLOCK));

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const error = await rescheduleMyAppointment(request, LOCK_NOW).catch((caught: unknown) => caught);

      expect((error as Error).message).toBe(DEADLOCK);
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
    });

    it("keeps mapping a non-bookable month (domain error) to SLOT_NOT_AVAILABLE", async () => {
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      getBookableMonthConfigMock.mockRejectedValueOnce(new Error("MONTH_NOT_ALLOWED"));

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      await expect(rescheduleMyAppointment(request, LOCK_NOW)).rejects.toThrow("SLOT_NOT_AVAILABLE");
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
    });

    // B-1 (D81/D91): solo MONTH_NOT_ALLOWED es de dominio; un error de infraestructura (pool, conexión) se propaga.
    it("propagates an infrastructure error from the month check instead of reporting SLOT_NOT_AVAILABLE", async () => {
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      getBookableMonthConfigMock.mockRejectedValueOnce(
        new Error("Timed out fetching a new connection from the connection pool"),
      );

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const error = await rescheduleMyAppointment(request, LOCK_NOW).catch((caught: unknown) => caught);

      expect((error as Error).message).toContain("Timed out fetching a new connection");
      expect((error as Error).message).not.toBe("SLOT_NOT_AVAILABLE");
      expect(appointmentUpdateMock).not.toHaveBeenCalled();
      expect(releaseBookingLocksMock).toHaveBeenCalledWith(expect.anything(), "2026-07-21", "5512345678");
    });

    it("reschedules when there are no active locks on the destination", async () => {
      queryRawMock.mockResolvedValueOnce([appointmentRow]).mockResolvedValueOnce([]);
      appointmentFindManyMock.mockResolvedValueOnce([]);

      const { rescheduleMyAppointment } = await import("@/lib/my-appointments/service");
      const result = await rescheduleMyAppointment(request, LOCK_NOW);

      expect(result.status).toBe("PENDING");
      expect(appointmentUpdateMock).toHaveBeenCalledTimes(1);
    });
  });
});
