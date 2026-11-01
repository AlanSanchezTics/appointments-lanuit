"use client";

import { useAvailabilityEditor } from "@/hooks/admin/months/useAvailabilityEditor";
import { useAvailabilitySave } from "@/hooks/admin/months/useAvailabilitySave";

type UseMonthAvailabilityControllerInput = {
  month: string;
  onSaved: () => Promise<void>;
};

// Une el editor de reglas con su guardado para el contenedor del detalle; AvailabilityEditorModal es presentacional.
export function useMonthAvailabilityController({ month, onSaved }: UseMonthAvailabilityControllerInput) {
  const editor = useAvailabilityEditor(month);
  const save = useAvailabilitySave({
    month,
    payload: editor.payload,
    expectedVersion: editor.availabilityVersion,
    onClose: editor.close,
    onSaved,
  });

  return { editor, save };
}
