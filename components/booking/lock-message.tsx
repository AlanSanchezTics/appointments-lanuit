import React from "react";
import { formatRemainingTime } from "@/lib/booking/formatters";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClockFour } from "@fortawesome/free-regular-svg-icons";

function LockMessage({ remainingSeconds }: { remainingSeconds: number }) {
  const { t } = useTranslation("common");
  return (
    <p className="flex items-center justify-center gap-1 rounded-3xl border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)] mb-[1rem]">
      <FontAwesomeIcon icon={faClockFour} />
      {t("booking.slotLockedForYou", {
        time: formatRemainingTime(remainingSeconds),
      })}
    </p>
  );
}

export default LockMessage;
