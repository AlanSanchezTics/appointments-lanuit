"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/public/button";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import {
  translateApiError,
  translateValidationError,
} from "@/lib/i18n/translate";
import type { AppLanguage } from "@/lib/i18n/config";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/assets/images/logo.png";
import { useTranslation } from "react-i18next";

type CancellationStep = "lookup" | "review" | "success";

type CancelableAppointment = {
  appointmentId: number;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  status: "CONFIRMED";
};

export function CancelForm() {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  const [step, setStep] = useState<CancellationStep>("lookup");
  const [phone, setPhone] = useState("");
  const [appointment, setAppointment] = useState<CancelableAppointment | null>(
    null,
  );
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null);
  const [cancelErrorCode, setCancelErrorCode] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupErrorCode(null);
    setCancelErrorCode(null);

    const normalizedPhone = phone.replace(/\D/g, "");

    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      setLookupErrorCode("PHONE_INVALID");
      return;
    }

    startSearchTransition(async () => {
      const response = await fetch("/api/cancelar/buscar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      const payload = (await response.json()) as CancelableAppointment & {
        error?: string;
        errorCode?: string;
      };

      if (!response.ok) {
        setLookupErrorCode(
          payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR",
        );
        return;
      }

      setAppointment(payload);
      setStep("review");
    });
  }

  function handleCancel() {
    if (!appointment) {
      return;
    }

    startCancelTransition(async () => {
      setCancelErrorCode(null);

      const response = await fetch("/api/cancelar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: appointment.phone,
          appointmentId: appointment.appointmentId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        errorCode?: string;
      };

      if (!response.ok) {
        setCancelErrorCode(
          payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR",
        );
        return;
      }

      setStep("success");
    });
  }

  function handleReset() {
    setStep("lookup");
    setAppointment(null);
    setLookupErrorCode(null);
    setCancelErrorCode(null);
    setPhone("");
  }

  const lookupError = lookupErrorCode
    ? lookupErrorCode === "PHONE_INVALID"
      ? translateValidationError(t, lookupErrorCode)
      : translateApiError(t, lookupErrorCode)
    : null;

  const cancelError = cancelErrorCode
    ? translateApiError(t, cancelErrorCode)
    : null;

  return (
    <section className="mx-auto w-full max-w-[24rem] rounded-[2.5rem] border border-white/70 bg-[var(--surface)] p-0 shadow-[0_34px_90px_rgba(52,37,31,0.16)] backdrop-blur md:max-w-[26rem] md:p-7">
      <div className="rounded-[2.15rem] border border-[rgba(255,255,255,0.72)] bg-white px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:px-6 md:py-7">
        {step === "lookup" ? (
          <form className="space-y-8" onSubmit={handleLookup}>
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
                  onChange={(event) => setPhone(event.target.value)}
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
        ) : null}

        {step === "review" && appointment ? (
          <div className="space-y-8">
            <header className="space-y-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
                {t("cancel.step2Of3")}
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em] mb-1.25">
                {t("cancel.confirmTitle")}
              </h2>
              <p className="text-[var(--muted)]">{t("cancel.confirmIntro")}</p>
              <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
                <div className="h-full w-2/3 rounded-full bg-[var(--accent)]" />
              </div>
            </header>

            <section className="rounded-[2rem] border border-[var(--border)] bg-white/80 p-6 shadow-[var(--shadow-soft)]">
              <dl className="space-y-5">
                <div>
                  <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                    {t("cancel.name")}
                  </dt>
                  <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
                    {appointment.name}
                  </dd>
                </div>
                <div className="border-t border-[var(--border)] pt-5">
                  <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                    {t("cancel.date")}
                  </dt>
                  <dd className="mt-1 text-[1.2rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
                    {formatLongDate(appointment.date, language)}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
                  <div>
                    <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                      {t("cancel.time")}
                    </dt>
                    <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
                      {formatTimeSlotLabel(appointment.timeSlot, language)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                      {t("cancel.phone")}
                    </dt>
                    <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
                      {formatPhoneForDisplay(appointment.phone)}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            {cancelError ? (
              <p className="rounded-3xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)]">
                {cancelError}
              </p>
            ) : null}

            <p className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)] mb-[2rem]">
              <b>{t("cancel.important")}</b>
              <br />
              {t("cancel.importantBody")}
            </p>

            <div className="space-y-4 flex flex-col items-center">
              <Button
                className="w-full py-4 text-[1.02rem] font-semibold"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                {isCancelling
                  ? t("cancel.cancelling")
                  : t("cancel.cancelButton")}
              </Button>
              <Link
                className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                onClick={handleReset}
                href="#"
              >
                {t("cancel.backLink")}
              </Link>
            </div>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="space-y-8">
            <div className="relative pt-2">
              <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
              <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
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
            <p className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)] mb-[1.5rem]">
              {t("cancel.successInfo")}
            </p>

            <div className="flex justify-center">
              <Link
                className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                href="/"
              >
                {t("cancel.backHome")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatPhoneForDisplay(phone: string) {
  const trimmed = phone.replace(/\D/g, "");

  if (trimmed.length !== 10) {
    return phone;
  }

  return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
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
