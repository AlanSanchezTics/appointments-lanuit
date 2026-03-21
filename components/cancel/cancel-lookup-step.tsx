import Image from "next/image";
import Link from "next/link";
import type { TFunction } from "i18next";

import Logo from "@/assets/images/logo.png";
import { Button } from "@/components/ui/public/button";

type CancelLookupStepProps = {
  phone: string;
  lookupError: string | null;
  isSearching: boolean;
  onPhoneChange: (value: string) => void;
  onLookupSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  t: TFunction;
};

export function CancelLookupStep({
  phone,
  lookupError,
  isSearching,
  onPhoneChange,
  onLookupSubmit,
  t,
}: CancelLookupStepProps) {
  return (
    <form className="space-y-8" onSubmit={onLookupSubmit}>
      <header className="space-y-4">
        <Image
          src={Logo}
          alt="La Nuit Nail Studio"
          width={192}
          height={192}
          className="mx-auto h-48 w-auto"
        />
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
          {t("cancel.step1Of3")}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.04em] mb-1.25">
          {t("cancel.title")}
        </h1>
        <p className="text-[var(--muted)]">{t("cancel.intro")}</p>
        <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
          <div className="h-full w-1/3 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      <div className="space-y-2 mb-[1.5rem]">
        <label className="relative block" htmlFor="cancel-phone">
          <span className="absolute left-4 top-0 -translate-y-1/2 bg-[var(--surface-strong)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)]">
            {t("cancel.phone")}
          </span>
          <input
            id="cancel-phone"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            placeholder="3221234567"
            inputMode="numeric"
            autoComplete="tel"
            required
          />
        </label>
      </div>

      {lookupError ? (
        <p className="rounded-3xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)] mb-[1.5rem]">
          {lookupError}
        </p>
      ) : null}

      <Button
        className="w-full py-4 text-[1.02rem] font-semibold mb-[1rem]"
        type="submit"
        disabled={isSearching}
      >
        {isSearching ? (
          t("cancel.searching")
        ) : (
          <>
            <SearchIcon />
            <span className="ml-2">{t("cancel.search")}</span>
          </>
        )}
      </Button>
      <div className="flex justify-center">
        <Link
          className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          href="/"
        >
          {t("cancel.back")}
        </Link>
      </div>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
    >
      <circle
        cx="8.5"
        cy="8.5"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M13.75 13.75L17.5 17.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

