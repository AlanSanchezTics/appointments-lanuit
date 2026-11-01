"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import {
  AdminMonthApiError,
  previewAdminMonthAvailability,
  saveAdminMonthAvailability,
} from "@/lib/admin/months/api-client";
import type {
  AffectedAppointmentItem,
  MonthAvailabilityResponse,
  PreviewAvailabilityPayload,
} from "@/lib/admin/months/types";
import {
  readAvailabilityErrorCode,
  resolveAvailabilityErrorKey,
} from "@/hooks/admin/months/useAvailabilityEditor";

const AFFECTED_CONFIRMATION_CODE = "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED";

type UseAvailabilitySaveInput = {
  month: string;
  payload: PreviewAvailabilityPayload;
  // null mientras el editor no ha cargado la versión: no se guarda sin control de concurrencia (D24).
  expectedVersion: number | null;
  onClose: () => void;
  onSaved?: (response: MonthAvailabilityResponse) => void | Promise<void>;
};

// Flujo de guardado (T042): preview -> diálogo si hay citas afectadas (D18) -> PUT con sileo.promise.
// El diálogo visual de citas afectadas es T047; aquí solo se expone su estado.
export function useAvailabilitySave({
  month,
  payload,
  expectedVersion,
  onClose,
  onSaved,
}: UseAvailabilitySaveInput) {
  const { t } = useTranslation("admin");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [affectedAppointments, setAffectedAppointments] = useState<AffectedAppointmentItem[]>([]);

  const isBusy = isPreviewing || isSaving;

  const openConfirm = useCallback((items: AffectedAppointmentItem[]) => {
    setAffectedAppointments(items);
    setIsConfirmOpen(true);
  }, []);

  const cancelConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    setAffectedAppointments([]);
  }, []);

  const persist = useCallback(
    async (confirmAffectedAppointments: boolean) => {
      if (expectedVersion === null) {
        return;
      }

      setIsSaving(true);
      // No se usa sileo.promise: su error no se puede silenciar y el 409 de confirmación no es un fallo.
      const loadingToastId = sileo.show({
        type: "loading",
        title: t("monthsDetail.availability.notifications.saveLoading"),
      });
      let response: MonthAvailabilityResponse;

      try {
        response = await saveAdminMonthAvailability(month, {
          ...payload,
          expectedVersion,
          confirmAffectedAppointments,
        });
      } catch (error) {
        sileo.dismiss(loadingToastId);
        setIsSaving(false);

        // Carrera: las citas cambiaron entre el preview y el PUT. El 409 trae la lista para el diálogo, sin notificación de error.
        if (error instanceof AdminMonthApiError && error.message === AFFECTED_CONFIRMATION_CODE) {
          openConfirm(error.affectedAppointments);
          return;
        }

        sileo.error({
          title: t("monthsDetail.availability.notifications.saveError"),
          description: t(resolveAvailabilityErrorKey(readAvailabilityErrorCode(error))),
        });
        return;
      }

      sileo.dismiss(loadingToastId);
      sileo.success({ title: t("monthsDetail.availability.notifications.saveSuccess") });
      cancelConfirm();

      // Ocupado hasta cerrar: mientras se recarga el mes, un segundo guardado usaría una versión ya superada.
      try {
        await onSaved?.(response);
        onClose();
      } finally {
        setIsSaving(false);
      }
    },
    [cancelConfirm, expectedVersion, month, onClose, onSaved, openConfirm, payload, t],
  );

  const requestSave = useCallback(async () => {
    if (isBusy || expectedVersion === null) {
      return;
    }

    setIsPreviewing(true);
    let affected: AffectedAppointmentItem[];

    try {
      const preview = await previewAdminMonthAvailability(month, payload);
      affected = preview.affectedAppointments;
    } catch (error) {
      setIsPreviewing(false);
      sileo.error({
        title: t("monthsDetail.availability.notifications.saveError"),
        description: t(resolveAvailabilityErrorKey(readAvailabilityErrorCode(error))),
      });
      return;
    }

    setIsPreviewing(false);

    if (affected.length > 0) {
      openConfirm(affected);
      return;
    }

    await persist(false);
  }, [expectedVersion, isBusy, month, openConfirm, payload, persist, t]);

  const confirmSave = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await persist(true);
  }, [isBusy, persist]);

  return {
    isBusy,
    isPreviewing,
    isSaving,
    isConfirmOpen,
    affectedAppointments,
    requestSave,
    confirmSave,
    cancelConfirm,
  };
}

export type AvailabilitySaveApi = ReturnType<typeof useAvailabilitySave>;
