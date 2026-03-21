import Link from "next/link";
import type { TFunction } from "i18next";

type CancelSuccessStepProps = {
  t: TFunction;
};

export function CancelSuccessStep({ t }: CancelSuccessStepProps) {
  return (
    <div className="space-y-8">
      <div className="relative pt-2">
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-[rgba(228,159,83,0.08)]">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[rgba(228,159,83,0.1)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--accent)] text-[var(--accent)]">
              <CalendarTimesIcon />
            </div>
          </div>
        </div>
      </div>
      <header className="space-y-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
          {t("cancel.step3Of3")}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em] mb-1.25">
          {t("cancel.successTitle")}
        </h2>
        <p className="text-[var(--muted)]">{t("cancel.successBody")}</p>
        <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
          <div className="h-full w-full rounded-full bg-[var(--accent)]" />
        </div>
      </header>
      <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
        <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
          {t("cancel.successInfo")}
        </p>
      </div>

      <div className="flex justify-center">
        <Link
          className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          href="/"
        >
          {t("cancel.backHome")}
        </Link>
      </div>
    </div>
  );
}

function CalendarTimesIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="40"
      viewBox="0 0 20 20"
      width="40"
    >
      <rect
        x="2.75"
        y="3.5"
        width="14.5"
        height="13.75"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6.5 2.75V5.25M13.5 2.75V5.25M2.75 8H17.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 11.25L12 15.25M12 11.25L8 15.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

