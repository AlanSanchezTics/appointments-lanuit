"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDayAgendaSlots } from "@/hooks/admin/months/fetch-day-agenda-slots";

type UseRescheduleTimeSlotsInput = {
  month: string;
  editDate: string;
  isEditing: boolean;
  // Cita en edición: el servidor la excluye de los ocupados, así su hora actual sigue ofrecida (PD-09).
  excludeAppointmentId?: number;
  // Hora actual de la cita en edición ("HH:mm"); se preselecciona si el servidor la ofrece.
  currentTimeSlot: string;
  // Cambia cuando la agenda del día se recarga; vuelve a pedir los horarios.
  reloadKey: unknown;
};

// Valor por defecto al llegar una lista: la hora actual de la cita si se ofrece; si no, la primera; sin horarios, "".
function pickDefaultEditTimeSlot(slots: string[], currentTimeSlot: string) {
  return slots.includes(currentTimeSlot) ? currentTimeSlot : (slots[0] ?? "");
}

// Horarios para reagendar desde la agenda del servidor (T049) y la hora elegida.
// Sin horarios confirmados por el servidor para la fecha mostrada, la hora elegida está vacía y Guardar no reagenda (D103).
// La elección explícita del usuario (setEditTimeSlot) sobrevive a las recargas de la misma fecha mientras siga ofrecida, y a los cambios de día
// (se restaura si el día nuevo la ofrece, D104). Cambiar de cita o cerrar el modal la reinicia.
export function useRescheduleTimeSlots({
  month,
  editDate,
  isEditing,
  excludeAppointmentId,
  currentTimeSlot,
  reloadKey,
}: UseRescheduleTimeSlotsInput) {
  const [availableEditSlots, setAvailableEditSlots] = useState<string[]>([]);
  const [editTimeSlot, setSelectedTimeSlot] = useState<string>("");
  // True solo mientras se piden los horarios de un día nuevo (la lista se vacía); las recargas de la misma fecha no lo activan.
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  // Ref: la elección no debe disparar recargas ni cambiar el momento en que se lee al llegar la lista.
  const userChoiceRef = useRef<string | null>(null);
  // Fecha de la última lista válida mostrada; null si no hay lista. Distingue recarga de la misma fecha de cambio de día.
  const loadedDateRef = useRef<string | null>(null);

  const setEditTimeSlot = useCallback((timeSlot: string) => {
    userChoiceRef.current = timeSlot;
    setSelectedTimeSlot(timeSlot);
  }, []);

  // Otra cita o cierre del modal: se descarta la elección y la lista anterior.
  useEffect(() => {
    userChoiceRef.current = null;
    loadedDateRef.current = null;
    setAvailableEditSlots([]);
    setSelectedTimeSlot("");
  }, [excludeAppointmentId, isEditing]);

  useEffect(() => {
    if (!isEditing || !editDate) {
      loadedDateRef.current = null;
      setIsLoadingSlots(false);
      setAvailableEditSlots([]);
      setSelectedTimeSlot("");
      return;
    }

    // Cambio de día: la lista y la hora visibles son del día anterior. Se vacían hasta que llega el día nuevo.
    // La elección explícita no se descarta aquí (D104).
    if (loadedDateRef.current !== editDate) {
      setIsLoadingSlots(true);
      setAvailableEditSlots([]);
      setSelectedTimeSlot("");
    }

    const isReload = loadedDateRef.current === editDate;
    const controller = new AbortController();

    fetchDayAgendaSlots(month, editDate, controller.signal, excludeAppointmentId)
      .then((slots) => {
        if (!controller.signal.aborted) {
          const choice = userChoiceRef.current;
          const keptChoice = choice !== null && slots.includes(choice) ? choice : null;
          // Recarga de la misma fecha: si la elección ya no se ofrece, se descarta y no vuelve (D103).
          if (isReload) {
            userChoiceRef.current = keptChoice;
          }

          loadedDateRef.current = editDate;
          setIsLoadingSlots(false);
          setAvailableEditSlots(slots);
          setSelectedTimeSlot(keptChoice ?? pickDefaultEditTimeSlot(slots, currentTimeSlot));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          loadedDateRef.current = null;
          setIsLoadingSlots(false);
          setAvailableEditSlots([]);
          setSelectedTimeSlot("");
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentTimeSlot, editDate, excludeAppointmentId, isEditing, month, reloadKey]);

  return { availableEditSlots, editTimeSlot, isLoadingSlots, setEditTimeSlot };
}
