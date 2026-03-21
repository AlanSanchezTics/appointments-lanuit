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
    const cancelUrl =
      typeof window === "undefined"
        ? "/cancelar"
        : `${window.location.origin}/cancelar`;
    const message = translate("whatsapp.messageTemplate", {
      name: success.whatsappData.name,
      date: formatLongDate(success.whatsappData.date, language),
      time: formatTimeSlotLabel(success.whatsappData.timeSlot, language),
      cancelUrl,
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
