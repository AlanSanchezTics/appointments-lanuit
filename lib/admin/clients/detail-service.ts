import { prisma } from "@/lib/db/prisma";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import {
  dateToDateKey,
  isActiveAppointment,
  isFutureActiveAppointment,
  timeToTimeSlotKey,
} from "@/lib/admin/clients/helpers";
import type { AdminClientDetailResponse } from "@/lib/admin/clients/types";

export async function getAdminClientDetail(
  clientId: number,
  now = new Date(),
): Promise<AdminClientDetailResponse> {
  const currentDate = getCurrentDateKey(now);
  const currentDateValue = new Date(`${currentDate}T00:00:00.000Z`);

  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    select: {
      id: true,
      clientNumber: true,
      name: true,
      alias: true,
      phone: true,
      isLoyal: true,
      createdAt: true,
      updatedAt: true,
      appointments: {
        select: {
          id: true,
          date: true,
          timeSlot: true,
          status: true,
        },
        orderBy: [
          {
            date: "desc",
          },
          {
            timeSlot: "desc",
          },
        ],
      },
    },
  });

  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const nextFutureActiveAppointment = [...client.appointments]
    .filter((appointment) =>
      isFutureActiveAppointment({
        status: appointment.status,
        date: appointment.date,
        currentDateValue,
      }))
    .sort((left, right) => {
      const byDate = left.date.getTime() - right.date.getTime();
      if (byDate !== 0) {
        return byDate;
      }

      return left.timeSlot.getTime() - right.timeSlot.getTime();
    })[0];

  const activeAppointments = client.appointments.filter((appointment) =>
    isActiveAppointment(appointment.status),
  );
  const cancelledAppointments = client.appointments.filter(
    (appointment) => appointment.status === "CANCELLED",
  );
  const futureActiveAppointments = activeAppointments.filter(
    (appointment) => appointment.date.getTime() > currentDateValue.getTime(),
  );

  return {
    client: {
      clientId: client.id,
      clientNumber: client.clientNumber,
      name: client.name,
      alias: client.alias,
      phone: client.phone,
      isLoyal: client.isLoyal,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    },
    summary: {
      totalAppointments: client.appointments.length,
      activeAppointments: activeAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      futureActiveAppointments: futureActiveAppointments.length,
      lastAppointmentDate: client.appointments[0]
        ? dateToDateKey(client.appointments[0].date)
        : null,
      nextAppointmentDate: nextFutureActiveAppointment
        ? dateToDateKey(nextFutureActiveAppointment.date)
        : null,
      nextAppointmentTimeSlot: nextFutureActiveAppointment
        ? timeToTimeSlotKey(nextFutureActiveAppointment.timeSlot)
        : null,
    },
    appointments: client.appointments.map((appointment) => ({
      appointmentId: appointment.id,
      date: dateToDateKey(appointment.date),
      timeSlot: timeToTimeSlotKey(appointment.timeSlot),
      status: appointment.status,
    })),
    currentDate,
  };
}
