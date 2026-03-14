import { prisma } from "@/lib/db/prisma";

export async function resetAppointmentsTable() {
  await prisma.reservationLock.deleteMany();
  await prisma.appointment.deleteMany();
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
