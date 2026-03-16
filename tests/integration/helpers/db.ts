import { prisma } from "@/lib/db/prisma";

export async function resetAppointmentsTable() {
  await prisma.activeMonth.deleteMany();
  await prisma.reservationLock.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();

  await prisma.activeMonth.createMany({
    data: [
      { month: "2026-03", status: "ACTIVE" },
      { month: "2026-04", status: "ACTIVE" },
      { month: "2026-02", status: "INACTIVE" },
    ],
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
