import { useCallback, useEffect, useRef } from "react";

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
  autoRedirectOnMount?: boolean;
};

export function useBookingSuccess({
  language,
  success,
  translate,
  onWhatsAppRedirect,
  autoRedirectOnMount = false,
}: UseBookingSuccessParams) {
  const autoRedirectKeyRef = useRef<string | null>(null);

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
          date: formattedDate,
          time: formattedTime,
          appurl:
            typeof window === "undefined"
              ? "/"
              : window.location.origin,
        });

    onWhatsAppRedirect(
      buildWhatsappUrlFromMessage({
        phone: success.whatsappPhone,
        message,
      }),
    );
  }, [language, onWhatsAppRedirect, success, translate]);

  useEffect(() => {
    if (!autoRedirectOnMount) {
      return;
    }

    const autoRedirectKey = `${success.appointmentId}:${success.status}`;

    if (autoRedirectKeyRef.current === autoRedirectKey) {
      return;
    }

    autoRedirectKeyRef.current = autoRedirectKey;
    handleWhatsAppClick();
  }, [autoRedirectOnMount, handleWhatsAppClick, success.appointmentId, success.status]);

  return {
    handleWhatsAppClick,
  };
}
