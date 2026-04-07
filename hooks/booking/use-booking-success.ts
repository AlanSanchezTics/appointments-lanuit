import { useCallback } from "react";

import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import type { BookingSuccess } from "@/lib/booking/types";

type TranslateFn = (
  key: string,
  options?: Record<string, string | number | undefined>,
) => string;

type UseBookingSuccessParams = {
  language: AppLanguage;
  success: BookingSuccess;
  translate: TranslateFn;
  onWhatsAppRedirect: (url: string) => void;
};

export function useBookingSuccess({
  language,
  success,
  translate,
  onWhatsAppRedirect,
}: UseBookingSuccessParams) {
  const handleWhatsAppClick = useCallback(() => {
    const formattedDate = formatLongDate(success.whatsappData.date, language);
    const formattedTime = formatTimeSlotLabel(success.whatsappData.timeSlot, language);
    const message =
      success.status === "PENDING"
        ? translate("whatsapp.pendingMessageTemplate", {
            name: success.whatsappData.name,
            date: formattedDate,
            time: formattedTime,
          })
        : translate("whatsapp.messageTemplate", {
            name: success.whatsappData.name,
            date: formattedDate,
            time: formattedTime,
            cancelUrl:
              typeof window === "undefined"
                ? "/citas/cancelar"
                : `${window.location.origin}/citas/cancelar`,
          });

    onWhatsAppRedirect(
      buildWhatsappUrlFromMessage({
        phone: success.whatsappPhone,
        message,
      }),
    );
  }, [language, onWhatsAppRedirect, success, translate]);

  return {
    handleWhatsAppClick,
  };
}
