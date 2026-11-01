import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { acquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import {
  findMonthAvailability,
  findMonthAvailabilityForShare,
  replaceMonthAvailability,
  type AvailabilityRuleInput,
} from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

const MONTH = "2026-03";
const NOW = new Date("2026-03-13T12:00:00.000Z");
const PHONE = "5512345678";

function monthRule(times: string[], weekdays = [1, 2, 3, 4, 5]): AvailabilityRuleInput {
  return {
    startDate: `${MONTH}-01`,
    endDate: `${MONTH}-31`,
    weekdays,
    times,
    minGapMinutes: 0,
    preserveCapacity: false,
    maxPerDay: 3,
  };
}

// Escribe reglas con la versión actual del mes (camino del editor, PD-07).
async function writeRules(rules: AvailabilityRuleInput[], expectedVersion?: number) {
  const current = await findMonthAvailability(MONTH);
  const version = expectedVersion ?? current?.availabilityVersion ?? 1;

  return prisma.$transaction((tx) =>
    replaceMonthAvailability(tx, {
      month: MONTH,
      expectedVersion: version,
      slotMode: "SECOND_ONLY_MODE",
      rules,
      exceptions: [],
    }),
  );
}

integrationSuite("availability rules concurrency integration", () => {
  // appointment_logs no lo borra el helper (fallo preexistente); se limpia aquí antes de resetear.
  beforeEach(async () => {
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("round-trips rules and exceptions through the database (N5)", async () => {
    const before = await findMonthAvailability(MONTH);
    const { availabilityVersion } = await prisma.$transaction((tx) =>
      replaceMonthAvailability(tx, {
        month: MONTH,
        expectedVersion: before?.availabilityVersion ?? 1,
        slotMode: "SECOND_ONLY_MODE",
        rules: [monthRule(["18:00", "10:00", "14:00"])],
        exceptions: [
          { date: `${MONTH}-07`, times: ["15:30", "11:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 2 },
        ],
      }),
    );

    const stored = await findMonthAvailability(MONTH);

    expect(availabilityVersion).toBe((before?.availabilityVersion ?? 1) + 1);
    expect(stored?.availabilityVersion).toBe(availabilityVersion);
    expect(stored?.slotMode).toBe("SECOND_ONLY_MODE");
    expect(stored?.rules).toEqual([
      expect.objectContaining({
        startDate: `${MONTH}-01`,
        endDate: `${MONTH}-31`,
        weekdays: [1, 2, 3, 4, 5],
        times: ["10:00", "14:00", "18:00"],
        minGapMinutes: 0,
        preserveCapacity: false,
        maxPerDay: 3,
      }),
    ]);
    expect(stored?.exceptions).toEqual([
      expect.objectContaining({
        date: `${MONTH}-07`,
        times: ["11:00", "15:30"],
        minGapMinutes: 0,
        preserveCapacity: false,
        maxPerDay: 2,
      }),
    ]);
  });

  it("rejects a stale expectedVersion without writing (FR-041)", async () => {
    await writeRules([monthRule(["10:00", "14:00"])]);
    const version = (await findMonthAvailability(MONTH))?.availabilityVersion ?? 0;

    await expect(writeRules([monthRule(["18:00"])], version - 1)).rejects.toThrow(
      "AVAILABILITY_VERSION_CONFLICT",
    );

    const stored = await findMonthAvailability(MONTH);
    expect(stored?.availabilityVersion).toBe(version);
    expect(stored?.rules[0].times).toEqual(["10:00", "14:00"]);
  });

  it("makes FOR SHARE reads wait for a rules write in progress (FR-041, R-06)", async () => {
    await writeRules([monthRule(["10:00"])]);
    const before = (await findMonthAvailability(MONTH))?.availabilityVersion ?? 0;

    // Editor: toma FOR UPDATE sobre active_months, escribe y espera antes de confirmar.
    const writer = prisma.$transaction(async (tx) => {
      await replaceMonthAvailability(tx, {
        month: MONTH,
        expectedVersion: before,
        slotMode: "SECOND_ONLY_MODE",
        rules: [monthRule(["14:00"])],
        exceptions: [],
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    const startedAt = Date.now();
    // Reserva: lectura FOR SHARE dentro de la transacción. Debe esperar al editor y ver la versión nueva.
    const reader = await prisma.$transaction((tx) => findMonthAvailabilityForShare(tx, MONTH));
    const waitedMs = Date.now() - startedAt;

    await writer;

    expect(reader?.availabilityVersion).toBe(before + 1);
    expect(reader?.rules[0].times).toEqual(["14:00"]);
    expect(waitedMs).toBeGreaterThanOrEqual(200);
  });

  it("rejects confirming a lock on a time the editor removed (D39)", async () => {
    await writeRules([monthRule(["10:00", "14:00", "18:00"])]);

    const lock = await acquireReservationSlotLock(
      { phone: PHONE, date: "2026-03-18", timeSlot: "14:00" },
      NOW,
    );

    const version = (await findMonthAvailability(MONTH))?.availabilityVersion ?? 0;
    await writeRules([monthRule(["10:00", "18:00"])], version);

    await expect(
      confirmAppointmentWithLock(
        {
          phone: PHONE,
          name: "Ana Lopez",
          date: "2026-03-18",
          timeSlot: "14:00",
          lockToken: lock.lockToken,
        },
        NOW,
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");

    const appointments = await prisma.appointment.count({
      where: { date: new Date("2026-03-18T00:00:00.000Z") },
    });
    expect(appointments).toBe(0);
  });
});
