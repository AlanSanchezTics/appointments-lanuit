import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { findMonthAvailability, replaceMonthAvailability } from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";
import { rescheduleMyAppointment } from "@/lib/my-appointments/service";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: vi.fn(async () => "gcal-test"),
  updateCalendarEvent: vi.fn(async () => undefined),
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// Mes futuro: la reprogramación pública valida el mes con la fecha real del servidor.
const MONTH = "2030-06";
const NOW = new Date("2030-05-20T12:00:00.000Z");
const TARGET_TIME = "10:00";
const PHONE_A = "5511111111";
const PHONE_B = "5522222222";
// Cada ronda usa otro día de destino; las reprogramaciones son PENDING, así que no llaman a Google Calendar.
const ROUNDS = 5;

async function writeRules() {
  const current = await findMonthAvailability(MONTH);

  await prisma.$transaction((tx) =>
    replaceMonthAvailability(tx, {
      month: MONTH,
      expectedVersion: current?.availabilityVersion ?? 1,
      slotMode: "SECOND_ONLY_MODE",
      rules: [
        {
          startDate: `${MONTH}-01`,
          endDate: `${MONTH}-30`,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times: ["10:00", "14:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 3,
        },
      ],
      exceptions: [],
    }),
  );
}

async function createPendingAppointment(clientId: number, date: string, timeSlot: string) {
  return prisma.appointment.create({
    data: {
      clientId,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
      status: "PENDING",
    },
  });
}

integrationSuite("public reschedule concurrency integration (B1)", () => {
  beforeEach(async () => {
    // appointment_logs no lo borra el helper (fallo preexistente); se limpia aquí antes de resetear.
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await writeRules();
    await prisma.client.create({ data: { clientNumber: 101, name: "Ana Lopez", phone: PHONE_A } });
    await prisma.client.create({ data: { clientNumber: 102, name: "Bea Ruiz", phone: PHONE_B } });
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("lets exactly one of two concurrent reschedules take the same date and hour", async () => {
    const clientA = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_A } });
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });

    for (let round = 0; round < ROUNDS; round += 1) {
      const targetDate = `${MONTH}-${String(10 + round).padStart(2, "0")}`;
      const appointmentA = await createPendingAppointment(clientA.id, `${MONTH}-01`, "14:00");
      const appointmentB = await createPendingAppointment(clientB.id, `${MONTH}-02`, "14:00");

      const results = await Promise.allSettled([
        rescheduleMyAppointment(
          {
            phone: PHONE_A,
            appointmentId: appointmentA.id,
            month: MONTH,
            date: targetDate,
            timeSlot: TARGET_TIME,
          },
          NOW,
        ),
        rescheduleMyAppointment(
          {
            phone: PHONE_B,
            appointmentId: appointmentB.id,
            month: MONTH,
            date: targetDate,
            timeSlot: TARGET_TIME,
          },
          NOW,
        ),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      expect(fulfilled, `round ${round}`).toHaveLength(1);
      expect(rejected, `round ${round}`).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message, `round ${round}`).toBe(
        "SLOT_NOT_AVAILABLE",
      );

      const winnerId = (fulfilled[0] as PromiseFulfilledResult<{ appointmentId: number }>).value.appointmentId;
      // El filtro de igualdad sobre TIME no coincide con Prisma; se compara la hora en memoria, como el servicio.
      const onDay = await prisma.appointment.findMany({
        where: { date: new Date(`${targetDate}T00:00:00.000Z`) },
        select: { id: true, timeSlot: true },
      });
      const atSlot = onDay.filter((record) => record.timeSlot.toISOString().slice(11, 16) === TARGET_TIME);

      expect(atSlot.map((record) => record.id), `round ${round}`).toEqual([winnerId]);
    }
  });
});
