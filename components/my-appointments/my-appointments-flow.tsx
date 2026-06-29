"use client";

import {
  faChevronLeft,
  faChevronRight,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import Logo from "@/assets/images/logo.png";
import ErrorMessage from "@/components/booking/error-message";
import { Button } from "@/components/ui/public/button";
import { useCancelSuccessWhatsapp } from "@/hooks/cancel/use-cancel-success-whatsapp";
import { useMyAppointmentsFlow } from "@/hooks/my-appointments/use-my-appointments-flow";
import {
  getLeadingBlanks,
  getMonthDates,
} from "@/lib/booking/calendar-helpers";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import {
  formatDayOfMonthLabel,
  formatLongDate,
  formatMonthLabel,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import {
  translateApiError,
  translateValidationError,
} from "@/lib/i18n/translate";
import type { MyAppointmentLookupItem } from "@/lib/my-appointments/types";
import {
  buildWhatsappUrlFromMessage,
  getWhatsappPhone,
} from "@/lib/whatsapp/message";

const WEEKDAY_HEADERS = {
  es: ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
} as const;

type MyAppointmentsFlowProps = {
  availableMonths: string[];
  onWhatsAppRedirect?: (url: string) => void;
};

export function MyAppointmentsFlow({
  availableMonths,
  onWhatsAppRedirect,
}: MyAppointmentsFlowProps) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const handleWhatsAppRedirect = useCallback(
    (url: string) => {
      if (onWhatsAppRedirect) {
        onWhatsAppRedirect(url);
        return;
      }

      window.location.assign(url);
    },
    [onWhatsAppRedirect],
  );
  const {
    step,
    phone,
    appointments,
    selectedAppointment,
    lookupErrorCode,
    actionErrorCode,
    successAction,
    successMessage,
    isSearching,
    isCanceling,
    isRescheduling,
    isLoadingAvailability,
    rescheduleMonth,
    rescheduleDays,
    selectedDate,
    selectedTimeSlot,
    setPhone,
    setRescheduleMonth,
    setSelectedDate,
    setSelectedTimeSlot,
    handleLookup,
    handleSelectAppointment,
    handleCancelSelected,
    handleStartModify,
    handleRescheduleConfirm,
    handleReset,
    handleBackToResults,
  } = useMyAppointmentsFlow(availableMonths);

  const lookupError = lookupErrorCode
    ? lookupErrorCode === "PHONE_INVALID"
      ? translateValidationError(t, lookupErrorCode)
      : translateApiError(t, lookupErrorCode)
    : null;

  const actionError = actionErrorCode
    ? translateApiError(t, actionErrorCode)
    : null;

  return (
    <section className="booking-mobile-shell p-6 md:p-6 min-h-screen flex items-center justify-center">
      <div className="w-full">
        {step === "lookup" ? (
          <form className="space-y-8" onSubmit={handleLookup}>
            <StepHeader
              stepLabel={t("myAppointments.step1Of3")}
              title={t("myAppointments.title")}
              description={t("myAppointments.lookupIntro")}
              progressWidth="w-1/3"
              showLogo
            />

            <div className="space-y-2">
              <label className="relative block" htmlFor="my-appointments-phone">
                <span className="absolute left-4 top-0 -translate-y-1/2 bg-[var(--surface-strong)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)]">
                  {t("myAppointments.phone")}
                </span>
                <input
                  id="my-appointments-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  placeholder={t("myAppointments.phonePlaceholder")}
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                />
              </label>
            </div>

            {lookupError ? <ErrorMessage message={lookupError} /> : null}

            <Button
              className="w-full py-4 text-[1.02rem] font-semibold"
              type="submit"
              disabled={isSearching}
            >
              {isSearching ? (
                t("myAppointments.searching")
              ) : (
                <>
                  <SearchIcon />
                  <span className="ml-2">{t("myAppointments.search")}</span>
                </>
              )}
            </Button>

            <div className="flex justify-center">
              <Link
                className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                href="/"
              >
                {t("myAppointments.back")}
              </Link>
            </div>
          </form>
        ) : null}

        {step === "results" ? (
          <div className="space-y-8">
            <StepHeader
              stepLabel={t("myAppointments.step2Of3")}
              title={t("myAppointments.resultsTitle")}
              description={t("myAppointments.resultsIntro")}
              progressWidth="w-2/3"
            />

            <section className="space-y-4">
              {selectedAppointment && (
                <>
                  <p className="text-2xl font-bold mb-0.5">
                    {t("myAppointments.helloName", {
                      name:
                        selectedAppointment.name.split(" ")[0] ??
                        selectedAppointment.name,
                    })}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t("cancel.confirmDetailsSubtitle")}
                  </p>
                </>
              )}
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                {t("myAppointments.selectAppointment")}
              </p>
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.appointmentId}
                    appointment={appointment}
                    language={language}
                    selected={
                      selectedAppointment?.appointmentId ===
                      appointment.appointmentId
                    }
                    onSelect={handleSelectAppointment}
                  />
                ))}
              </div>
            </section>

            {actionError ? <ErrorMessage message={actionError} /> : null}

            {selectedAppointment?.isBlocked ? (
              <div
                className={`flex items-center gap-3 rounded-[0.9rem] px-4 py-3 text-left ${
                  selectedAppointment.canCancel || selectedAppointment.canModify
                    ? "bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[var(--warning)]"
                    : "bg-[color-mix(in_srgb,var(--error)_18%,white)] text-[var(--error)]"
                }`}
              >
                <WarningIcon />
                <p className="text-[0.78rem] font-bold">
                  {resolveBlockedMessage(selectedAppointment, t)}
                </p>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
              <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
                <b>{t("cancel.important")}</b>
                <br />
                {t("myAppointments.importantBody")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Button
                  className="w-full py-4 text-[1rem] font-semibold"
                  disabled={
                    isRescheduling ||
                    !selectedAppointment ||
                    !selectedAppointment.canModify
                  }
                  onClick={handleStartModify}
                  type="button"
                >
                  {isRescheduling
                    ? t("myAppointments.preparing")
                    : t("myAppointments.modifyAction")}
                </Button>
                <Button
                  className="w-full py-4 text-[1rem] font-semibold"
                  disabled={
                    isCanceling ||
                    !selectedAppointment ||
                    !selectedAppointment.canCancel
                  }
                  onClick={handleCancelSelected}
                  type="button"
                  variant="destructive"
                >
                  {isCanceling
                    ? t("myAppointments.cancelling")
                    : t("myAppointments.cancelAction")}
                </Button>
              </div>
              <Button
                className="w-full py-4 text-[1rem] font-semibold"
                type="button"
                variant="ghost"
                onClick={handleReset}
              >
                {t("myAppointments.searchAnother")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "reschedule" ? (
          <div className="space-y-8">
            <StepHeader
              stepLabel={t("myAppointments.step3Of3")}
              title={t("myAppointments.rescheduleTitle")}
              description={t("myAppointments.rescheduleIntro")}
              progressWidth="w-full"
            />

            {selectedAppointment ? (
              <section className="space-y-4 rounded-[1.15rem] border border-[rgba(194,165,138,0.42)] bg-[rgba(243,229,214,0.55)] p-5">
                <p className="text-sm font-semibold text-[var(--accent-dark)]">
                  {t("myAppointments.currentAppointment")}
                </p>
                <AppointmentDetails
                  appointment={selectedAppointment}
                  language={language}
                  t={t}
                />
              </section>
            ) : null}

            {actionError ? <ErrorMessage message={actionError} /> : null}

            <RescheduleCalendar
              availableMonths={availableMonths}
              isLoadingAvailability={isLoadingAvailability}
              language={language}
              month={rescheduleMonth}
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              days={rescheduleDays}
              onPreviousMonth={() => {
                const index = availableMonths.indexOf(rescheduleMonth);
                if (index > 0) {
                  setRescheduleMonth(availableMonths[index - 1]);
                }
              }}
              onNextMonth={() => {
                const index = availableMonths.indexOf(rescheduleMonth);
                if (index >= 0 && index < availableMonths.length - 1) {
                  setRescheduleMonth(availableMonths[index + 1]);
                }
              }}
              onSelectDate={(date) => {
                const day = rescheduleDays.find((item) => item.date === date);
                setSelectedDate(date);
                setSelectedTimeSlot(day?.slots[0] ?? null);
              }}
              onSelectTimeSlot={setSelectedTimeSlot}
              t={t}
            />

            <div className="space-y-4 pt-1">
              <Button
                className="w-full py-4 text-[1.02rem] font-semibold"
                disabled={isRescheduling || !selectedDate || !selectedTimeSlot}
                onClick={handleRescheduleConfirm}
                type="button"
              >
                {isRescheduling
                  ? t("myAppointments.rescheduling")
                  : t("myAppointments.confirmReschedule")}
              </Button>
              <Button
                className="w-full py-4 text-[1.02rem] font-semibold"
                variant="ghost"
                onClick={handleBackToResults}
                type="button"
              >
                {t("myAppointments.back")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "success" ? (
          <MyAppointmentsSuccessStep
            appointment={selectedAppointment}
            appointments={appointments}
            language={language}
            selectedDate={selectedDate}
            selectedTimeSlot={selectedTimeSlot}
            successAction={successAction}
            successMessage={
              successMessage ?? t("myAppointments.successFallback")
            }
            onReset={handleReset}
            onWhatsAppRedirect={handleWhatsAppRedirect}
            t={t}
          />
        ) : null}
      </div>
    </section>
  );
}

function StepHeader({
  stepLabel,
  title,
  description,
  progressWidth,
  showLogo = false,
}: {
  stepLabel: string;
  title: string;
  description: string;
  progressWidth: string;
  showLogo?: boolean;
}) {
  return (
    <header className="space-y-4">
      {showLogo ? (
        <Image
          src={Logo}
          alt="La Nuit Nail Studio"
          width={192}
          height={192}
          className="mx-auto h-48 w-auto"
        />
      ) : null}
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
        {stepLabel}
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em]">
        {title}
      </h1>
      <p className="text-[var(--muted)]">{description}</p>
      <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
        <div
          className={`h-full rounded-full bg-[var(--accent)] ${progressWidth}`}
        />
      </div>
    </header>
  );
}

function MyAppointmentsSuccessStep({
  appointment,
  appointments,
  language,
  selectedDate,
  selectedTimeSlot,
  successAction,
  successMessage,
  onReset,
  onWhatsAppRedirect,
  t,
}: {
  appointment: MyAppointmentLookupItem | null;
  appointments: MyAppointmentLookupItem[];
  language: AppLanguage;
  selectedDate: string | null;
  selectedTimeSlot: string | null;
  successAction: "cancel" | "reschedule" | null;
  successMessage: string;
  onReset: () => void;
  onWhatsAppRedirect: (url: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const autoRedirectedUrlRef = useRef<string | null>(null);
  const { whatsappUrl } = useCancelSuccessWhatsapp({
    appointments: appointments
      .filter(
        (
          item,
        ): item is MyAppointmentLookupItem & {
          status: "CONFIRMED" | "SYNC_FAILED";
        } => item.status === "CONFIRMED" || item.status === "SYNC_FAILED",
      )
      .map((item) => ({
        appointmentId: item.appointmentId,
        name: item.name,
        phone: item.phone,
        date: item.date,
        timeSlot: item.timeSlot,
        status: item.status,
      })),
    language,
    selectedAppointmentIds: appointment ? [appointment.appointmentId] : [],
    translate: (key, options) => t(key, options) as string,
  });
  const rescheduleWhatsappUrl = useMemo(() => {
    if (successAction !== "reschedule" || !appointment) {
      return null;
    }

    const message = t("whatsapp.messageUpdatedTemplate", {
      date: formatLongDate(selectedDate ?? appointment.date, language),
      time: formatTimeSlotLabel(
        selectedTimeSlot ?? appointment.timeSlot,
        language,
      ),
      appurl:
        typeof window === "undefined"
          ? "/my-appointments"
          : `${window.location.origin}/my-appointments`,
    });

    return buildWhatsappUrlFromMessage({
      phone: getWhatsappPhone(),
      message,
    });
  }, [appointment, language, selectedDate, selectedTimeSlot, successAction, t]);

  useEffect(() => {
    if (successAction !== "cancel" || !whatsappUrl) {
      return;
    }

    if (autoRedirectedUrlRef.current === whatsappUrl) {
      return;
    }

    autoRedirectedUrlRef.current = whatsappUrl;
    onWhatsAppRedirect(whatsappUrl);
  }, [onWhatsAppRedirect, successAction, whatsappUrl]);

  useEffect(() => {
    if (successAction !== "reschedule" || !rescheduleWhatsappUrl) {
      return;
    }

    if (autoRedirectedUrlRef.current === rescheduleWhatsappUrl) {
      return;
    }

    autoRedirectedUrlRef.current = rescheduleWhatsappUrl;
    onWhatsAppRedirect(rescheduleWhatsappUrl);
  }, [onWhatsAppRedirect, rescheduleWhatsappUrl, successAction]);

  return (
    <div className="flex h-full flex-col space-y-7">
      <div className="relative flex flex-col items-center pt-1 text-center">
        <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
        <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.12)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <CheckIcon />
          </div>
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
          {successMessage}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {t("myAppointments.successBody")}
        </p>
      </div>

      {appointment ? (
        <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
          <dl className="space-y-4 text-sm">
            <div className="mb-5 border-b border-[var(--border)] pb-3">
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("booking.name")}
              </dt>
              <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
                {appointment.name}
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <CalendarIcon />
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.date")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatLongDate(selectedDate ?? appointment.date, language)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ClockIcon />
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.time")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatTimeSlotLabel(
                    selectedTimeSlot ?? appointment.timeSlot,
                    language,
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <PhoneIcon />
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.phone")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatPhoneForDisplay(appointment.phone)}
                </p>
              </div>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
        <MessageIcon />
        <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
          {t("myAppointments.successInfo")}
        </p>
      </div>

      <div className="mt-auto space-y-4 pt-2">
        {successAction === "cancel" && whatsappUrl ? (
          <a
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-4 py-4 text-[1rem] font-semibold! text-white! transition duration-200 hover:brightness-95"
            href={whatsappUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("cancel.notifyWhatsapp")}
          </a>
        ) : successAction === "reschedule" && rescheduleWhatsappUrl ? (
          <a
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-4 py-4 text-[1rem] font-semibold! text-white! transition duration-200 hover:brightness-95"
            href={rescheduleWhatsappUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("booking.sendWhatsapp")}
          </a>
        ) : (
          <Button
            className="w-full min-h-14 py-4 text-[1rem] font-semibold"
            onClick={onReset}
            type="button"
          >
            {t("myAppointments.searchAnother")}
          </Button>
        )}
        <Link
          className="inline-flex w-full items-center justify-center text-[0.9rem] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          href={successAction === "cancel" ? "/" : "#"}
          onClick={successAction === "cancel" ? undefined : onReset}
        >
          {successAction === "cancel"
            ? t("cancel.backHome")
            : t("myAppointments.backHome")}
        </Link>
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  language,
  selected,
  onSelect,
}: {
  appointment: MyAppointmentLookupItem;
  language: AppLanguage;
  selected: boolean;
  onSelect: (appointmentId: number) => void;
}) {
  return (
    <button
      className={`w-full rounded-[0.95rem] border px-4 py-3 text-left transition ${
        selected
          ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)] shadow-[0_0_0_1px_rgba(228,159,83,0.16)]"
          : "border-[rgba(43,36,33,0.12)] bg-white/80"
      }`}
      onClick={() => onSelect(appointment.appointmentId)}
      type="button"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[0.95rem] font-semibold leading-tight text-[var(--foreground)]">
              {formatLongDate(appointment.date, language)}
            </p>
            <p className="text-[0.92rem] font-medium text-[var(--muted)]">
              {formatTimeSlotLabel(appointment.timeSlot, language)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

function AppointmentDetails({
  appointment,
  language,
  t,
}: {
  appointment: MyAppointmentLookupItem;
  language: AppLanguage;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <dl className="space-y-4 text-sm">
      <div className="flex items-start gap-3">
        <CalendarIcon />
        <div>
          <p className="text-xs text-[var(--muted)]">{t("booking.date")}</p>
          <p className="font-semibold text-[var(--foreground)]">
            {formatLongDate(appointment.date, language)}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <ClockIcon />
        <div>
          <p className="text-xs text-[var(--muted)]">{t("booking.time")}</p>
          <p className="font-semibold text-[var(--foreground)]">
            {formatTimeSlotLabel(appointment.timeSlot, language)}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <PhoneIcon />
        <div>
          <p className="text-xs text-[var(--muted)]">{t("booking.phone")}</p>
          <p className="font-semibold text-[var(--foreground)]">
            {formatPhoneForDisplay(appointment.phone)}
          </p>
        </div>
      </div>
    </dl>
  );
}

function RescheduleCalendar({
  availableMonths,
  isLoadingAvailability,
  language,
  month,
  selectedDate,
  selectedTimeSlot,
  days,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  onSelectTimeSlot,
  t,
}: {
  availableMonths: string[];
  isLoadingAvailability: boolean;
  language: AppLanguage;
  month: string;
  selectedDate: string | null;
  selectedTimeSlot: string | null;
  days: Array<{ date: string; slots: string[] }>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
  onSelectTimeSlot: (timeSlot: string | null) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const monthIndex = availableMonths.indexOf(month);
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < availableMonths.length - 1;
  const monthDates = month ? getMonthDates(month) : [];
  const leadingBlanks = month ? getLeadingBlanks(month) : 0;
  const availabilityByDate = new Map(
    days.map((day) => [day.date, day] as const),
  );
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  return (
    <section className="space-y-4">
      {isLoadingAvailability ? (
        <p className="text-sm text-[var(--muted)]">
          {t("myAppointments.loadingAvailability")}
        </p>
      ) : null}

      <div className="grid w-full grid-cols-[2.25rem_1fr_2.25rem] items-center gap-3">
        <button
          aria-label={t("booking.previousMonth")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] disabled:opacity-40"
          disabled={!canGoPrev}
          onClick={onPreviousMonth}
          type="button"
        >
          <FontAwesomeIcon icon={faChevronLeft} color="var(--foreground)" />
        </button>
        <span className="w-full text-center text-xl font-bold text-[var(--foreground)]">
          {month
            ? formatMonthLabel(month, language)
            : t("myAppointments.noMonths")}
        </span>
        <button
          aria-label={t("booking.nextMonth")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] disabled:opacity-40"
          disabled={!canGoNext}
          onClick={onNextMonth}
          type="button"
        >
          <FontAwesomeIcon icon={faChevronRight} color="var(--foreground)" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
        {WEEKDAY_HEADERS[language].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span
            key={`blank-${index}`}
            aria-hidden="true"
            className="h-11 w-11"
          />
        ))}
        {monthDates.map((date) => {
          const isSelected = selectedDate === date;
          const day = availabilityByDate.get(date);
          const isAvailable = Boolean(day && day.slots.length > 0);

          return (
            <button
              key={date}
              aria-label={`${isSelected ? t("booking.calendarAriaSelected") : t("booking.calendarAriaSelect")} ${formatShortWeekdayLabel(date, language)} ${formatDayOfMonthLabel(date)}`}
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-base font-medium transition ${
                isSelected
                  ? "border border-[var(--accent)] bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]"
                  : isAvailable
                    ? "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                    : "cursor-not-allowed text-[var(--muted-light)]"
              }`}
              disabled={!isAvailable}
              onClick={() => {
                onSelectDate(date);
                if (!day?.slots.includes(selectedTimeSlot ?? "")) {
                  onSelectTimeSlot(day?.slots[0] ?? null);
                }
              }}
              type="button"
            >
              {formatDayOfMonthLabel(date)}
            </button>
          );
        })}
      </div>

      <section className="space-y-4">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {t("booking.selectTime")}
        </p>
        <div
          className={`grid ${
            (selectedDay?.slots.length ?? 0) > 3
              ? "grid-cols-2"
              : `grid-cols-${selectedDay?.slots.length ?? 1}`
          } gap-4`}
        >
          {(selectedDay?.slots ?? []).map((slot) => {
            const isSelected = selectedTimeSlot === slot;

            return (
              <button
                key={slot}
                className={`min-h-14 rounded-full border px-4 text-[0.96rem] tracking-[-0.01em] transition ${
                  isSelected
                    ? "border border-[var(--accent)] bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
                onClick={() => onSelectTimeSlot(slot)}
                type="button"
              >
                {formatTimeSlotLabel(slot, language)}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function resolveBlockedMessage(
  appointment: MyAppointmentLookupItem,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (appointment.canCancel && !appointment.canModify) {
    return t("myAppointments.modifyWindowExpired");
  }

  if (!appointment.canCancel && appointment.canModify) {
    return t("myAppointments.cancelWindowExpired");
  }

  return t("myAppointments.allActionsExpired");
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="40"
      viewBox="0 0 20 20"
      width="40"
    >
      <path
        d="M5.5 10.5L8.75 13.75L14.5 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 20 20"
        width="18"
      >
        <rect
          height="13"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.6"
          width="14"
          x="3"
          y="4"
        />
        <path
          d="M6.5 2.75V5.5M13.5 2.75V5.5M3 8.5H17"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function ClockIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 8v4l2.75 1.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function PhoneIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <path
          d="M6.2 3.5h2.5l1.2 4-1.8 1.8a14.5 14.5 0 006.7 6.7l1.8-1.8 4 1.2v2.5a2 2 0 01-2.2 2A16.9 16.9 0 013.5 5.7a2 2 0 012-2.2z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

function MessageIcon() {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <path
          d="M4.75 7.25A2.5 2.5 0 017.25 4.75h9.5a2.5 2.5 0 012.5 2.5v6.5a2.5 2.5 0 01-2.5 2.5H11l-3.75 3v-3a2.5 2.5 0 01-2.5-2.5z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function WarningIcon() {
  return (
    <FontAwesomeIcon
      icon={faExclamationTriangle}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
    />
  );
}
