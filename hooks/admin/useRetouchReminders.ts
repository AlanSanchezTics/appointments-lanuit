"use client";

import type { TFunction } from "i18next";

import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";
import type { RetouchReminderItem } from "@/lib/admin/dashboard/types";
import { resolveClientDisplayName } from "@/lib/shared/client-name";

type UseRetouchRemindersInput = {
  t: TFunction<"admin">;
};

export function useRetouchReminders({ t }: UseRetouchRemindersInput) {
  function sendRetouchReminder(item: RetouchReminderItem) {
    const message = t("dashboard.retouchReminders.whatsapp.message", {
      name: resolveClientDisplayName(item, true),
    });
    const whatsappUrl = buildWhatsappUrlFromMessage({
      phone: `52${item.phone}`,
      message,
    });

    window.location.assign(whatsappUrl);
  }

  return {
    sendRetouchReminder,
  };
}
