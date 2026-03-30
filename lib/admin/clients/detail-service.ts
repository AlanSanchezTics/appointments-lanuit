import { prisma } from "@/lib/db/prisma";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  dateToDateKey,
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
      name: true,
      phone: true,
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
      ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      && appointment.date.getTime() > currentDateValue.getTime(),
    )
    .sort((left, right) => {
      const leftDateTime = `${dateToDateKey(left.date)}T${timeToTimeSlotKey(left.timeSlot)}:00`;
      const rightDateTime = `${dateToDateKey(right.date)}T${timeToTimeSlotKey(right.timeSlot)}:00`;

      return leftDateTime.localeCompare(rightDateTime);
    })[0];

  const activeAppointments = client.appointments.filter((appointment) =>
    ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status),
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
      name: client.name,
      phone: client.phone,
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
