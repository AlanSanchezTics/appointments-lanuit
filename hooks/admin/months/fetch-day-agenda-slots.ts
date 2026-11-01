import { fetchAdminDayAgenda } from "@/lib/admin/appointments/api-client";

// Horarios que el servidor ofrece ese día (resolvedor, sin ocupados, bloqueos ni locks). Son la misma fuente que
// valida crear y reagendar (D68), así que la UI no calcula horarios en navegador.
export async function fetchDayAgendaSlots(
  month: string,
  date: string,
  signal?: AbortSignal,
  excludeAppointmentId?: number,
): Promise<string[]> {
  const agenda = await fetchAdminDayAgenda(month, date, signal, excludeAppointmentId);

  return agenda.availableSlots;
}
