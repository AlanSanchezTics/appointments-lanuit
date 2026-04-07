"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import {
  formatDayOfMonthLabel,
  formatLongDate,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
  parseDateOnly,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import type { AdminCreateAppointmentResponse } from "@/lib/admin/appointments/types";
import type { AdminBlockableDay } from "@/lib/admin/blocked-spaces/types";
import type { AdminClientSearchItem } from "@/lib/admin/clients/types";
import type { BaseTimeSlot } from "@/lib/constants/slots";
import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";

type ClientMode = "existing" | "new";

type FieldErrors = {
  date?: string;
  timeSlot?: string;
  client?: string;
  name?: string;
  phone?: string;
};

type BookAppointmentModalProps = {
  isOpen: boolean;
  isLoadingDays: boolean;
  isSubmitting: boolean;
  isReadyToSubmit: boolean;
  errorCode: string | null;
  fieldErrors: FieldErrors;
  days: AdminBlockableDay[];
  selectedDate: string | null;
  selectedDaySlots: BaseTimeSlot[];
  selectedTimeSlot: BaseTimeSlot | null;
  clientMode: ClientMode;
  searchQuery: string;
  searchResults: AdminClientSearchItem[];
  isSearchingClients: boolean;
  selectedClient: AdminClientSearchItem | null;
  newClientName: string;
  newClientPhone: string;
  newClientNumber: string;
  successResult: AdminCreateAppointmentResponse | null;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onSelectTimeSlot: (timeSlot: BaseTimeSlot) => void;
  onChangeClientMode: (mode: ClientMode) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectClient: (client: AdminClientSearchItem) => void;
  onNewClientNameChange: (name: string) => void;
  onNewClientPhoneChange: (phone: string) => void;
  onNewClientNumberChange: (clientNumber: string) => void;
  onSubmit: () => void;
  onBackFromSuccess: () => void;
};

function resolveLanguage(language: string): AppLanguage {
  return language.startsWith("en") ? "en" : "es";
}

export function BookAppointmentModal({
  isOpen,
  isLoadingDays,
  isSubmitting,
  isReadyToSubmit,
  errorCode,
  fieldErrors,
  days,
  selectedDate,
  selectedDaySlots,
  selectedTimeSlot,
  clientMode,
  searchQuery,
  searchResults,
  isSearchingClients,
  selectedClient,
  newClientName,
  newClientPhone,
  newClientNumber,
  successResult,
  onClose,
  onSelectDate,
  onSelectTimeSlot,
  onChangeClientMode,
  onSearchQueryChange,
  onSelectClient,
  onNewClientNameChange,
  onNewClientPhoneChange,
  onNewClientNumberChange,
  onSubmit,
  onBackFromSuccess,
}: BookAppointmentModalProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveLanguage(i18n.resolvedLanguage ?? "es");
  const locale = language === "en" ? "en-US" : "es-MX";
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);
  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const successDateLabel = useMemo(() => {
    if (!successResult) {
      return "";
    }

    return formatLongDate(successResult.date, language);
  }, [language, successResult]);

  const submitLabel = isSubmitting
    ? t("monthsDetail.bookModal.actions.submitting")
    : t("monthsDetail.bookModal.actions.submit");
  const selectedClientLabel = selectedClient
    ? `${selectedClient.name} · #${selectedClient.clientNumber} · ${formatPhoneForDisplay(selectedClient.phone)}`
    : t("monthsDetail.bookModal.placeholders.searchClient");

  useEffect(() => {
    if (clientMode !== "existing" || isSubmitting) {
      setIsClientDropdownOpen(false);
    }
  }, [clientMode, isSubmitting]);

  useEffect(() => {
    if (!isClientDropdownOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!clientDropdownRef.current) {
        return;
      }

      if (!clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isClientDropdownOpen]);

  useEffect(() => {
    if (!isOpen || !selectedDate || isLoadingDays) {
      return;
    }

    const selectedDayButton = dayButtonRefs.current[selectedDate];

    if (
      !selectedDayButton ||
      typeof selectedDayButton.scrollIntoView !== "function"
    ) {
      return;
    }

    requestAnimationFrame(() => {
      selectedDayButton.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
    });
  }, [isLoadingDays, isOpen, selectedDate]);

  const whatsappUrl = useMemo(() => {
    if (!successResult) {
      return "";
    }

    const dateValue = parseDateOnly(successResult.date);
    const whatsappDateLabel = new Intl.DateTimeFormat(locale, {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dateValue);
    const whatsappTimeLabel = formatTimeSlotLabel(
      successResult.timeSlot,
      language,
    ).toLowerCase();
    const message = t("monthsDetail.bookModal.success.whatsappMessage", {
      name: successResult.client.name,
      date: whatsappDateLabel,
      time: whatsappTimeLabel,
    });

    return buildWhatsappUrlFromMessage({
      phone: `+52${successResult.client.phone}`,
      message,
    });
  }, [language, locale, successResult, t]);

  function handleWhatsappRedirect() {
    if (!whatsappUrl || typeof window === "undefined") {
      return;
    }

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      disableClose={isSubmitting || Boolean(successResult)}
      title={t("monthsDetail.bookModal.title")}
      closeLabel={t("monthsDetail.bookModal.close")}
    >
      {successResult ? (
        <div className="space-y-6 py-3">
          <div className="flex justify-center relative">
            <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
            <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.12)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-white bg-[var(--accent)]">
                <CheckIcon />
              </div>
            </div>
          </div>
          <header className="space-y-2 text-center">
            <h2 className="text-4xl font-extrabold tracking-[-0.03em] text-[var(--admin-text-primary)]">
              {t("monthsDetail.bookModal.success.title")}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {t("monthsDetail.bookModal.success.description")}
            </p>
          </header>
          <section className="rounded-[1.15rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
            <div className="mb-5 border-b border-[var(--admin-border)] pb-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--admin-text-secondary)]">
                {t("monthsDetail.bookModal.success.labels.name")}
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--admin-text-primary)]">
                {successResult.client.name}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarSuccessIcon />
                <div>
                  <p className="text-xs text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.bookModal.success.labels.date")}
                  </p>
                  <p className="font-semibold text-[var(--admin-text-primary)]">
                    {successDateLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ClockSuccessIcon />
                <div>
                  <p className="text-xs text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.bookModal.success.labels.time")}
                  </p>
                  <p className="font-semibold text-[var(--admin-text-primary)]">
                    {formatTimeSlotLabel(successResult.timeSlot, language)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <PhoneSuccessIcon />
                <div>
                  <p className="text-xs text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.bookModal.success.labels.phone")}
                  </p>
                  <p className="font-semibold text-[var(--admin-text-primary)]">
                    {formatPhoneForDisplay(successResult.client.phone)}
                  </p>
                </div>
              </div>
            </div>
          </section>
          <div className="space-y-3">
            <Button type="button" fullWidth onClick={handleWhatsappRedirect}>
              {t("monthsDetail.bookModal.success.sendWhatsapp")}
            </Button>
            <Button
              type="button"
              fullWidth
              variant="ghost"
              onClick={onBackFromSuccess}
            >
              {t("monthsDetail.bookModal.success.back")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-7 pb-2">
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
              {t("monthsDetail.bookModal.sections.day")}
            </h3>
            {isLoadingDays ? (
              <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
                {t("monthsDetail.bookModal.loading")}
              </p>
            ) : null}

            {!isLoadingDays && !errorCode && days.length === 0 ? (
              <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
                {t("monthsDetail.bookModal.emptyDays")}
              </p>
            ) : null}

            {!isLoadingDays && days.length > 0 ? (
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {days.map((day) => {
                  const isSelected = selectedDate === day.date;
                  return (
                    <button
                      type="button"
                      key={day.date}
                      ref={(element) => {
                        dayButtonRefs.current[day.date] = element;
                      }}
                      onClick={() => onSelectDate(day.date)}
                      disabled={isSubmitting}
                      className={`flex h-[88px] min-w-[72px] flex-col items-center justify-center rounded-2xl px-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                        isSelected
                          ? "bg-[var(--admin-primary)] text-white shadow-sm"
                          : "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]"
                      }`}
                    >
                      <span
                        className={`text-[12px] font-semibold ${isSelected ? "text-white/90" : "text-[var(--admin-text-secondary)]"}`}
                      >
                        {formatShortWeekdayLabel(day.date, language)}
                      </span>
                      <span className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em]">
                        {formatDayOfMonthLabel(day.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {fieldErrors.date ? (
              <p className="text-sm text-red-700">
                {t("monthsDetail.bookModal.errors.dateRequired")}
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
              {t("monthsDetail.bookModal.sections.time")}
            </h3>

            {selectedDate && selectedDaySlots.length > 0 ? (
              <div
                className={`grid gap-3 ${selectedDaySlots.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {selectedDaySlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      disabled={isSubmitting}
                      onClick={() => onSelectTimeSlot(slot)}
                      className={`min-h-14 rounded-2xl border px-4 text-[0.96rem] font-bold tracking-[-0.01em] transition ${
                        isSelected
                          ? "border-transparent bg-[var(--admin-primary)] text-white"
                          : "border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]"
                      }`}
                    >
                      {formatTimeSlotLabel(slot, language)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
                {t("monthsDetail.bookModal.emptySlots")}
              </p>
            )}
            {fieldErrors.timeSlot ? (
              <p className="text-sm text-red-700">
                {t("monthsDetail.bookModal.errors.timeRequired")}
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
              {t("monthsDetail.bookModal.sections.client")}
            </h3>
            <div className="inline-flex w-full rounded-full bg-[var(--admin-inactive-bg)] p-1">
              <button
                type="button"
                disabled={isSubmitting}
                aria-pressed={clientMode === "existing"}
                onClick={() => onChangeClientMode("existing")}
                className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                  clientMode === "existing"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-text-primary)] shadow-sm"
                    : "text-[var(--admin-text-secondary)]"
                }`}
              >
                {t("monthsDetail.bookModal.clientModes.existing")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                aria-pressed={clientMode === "new"}
                onClick={() => onChangeClientMode("new")}
                className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                  clientMode === "new"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-text-primary)] shadow-sm"
                    : "text-[var(--admin-text-secondary)]"
                }`}
              >
                {t("monthsDetail.bookModal.clientModes.new")}
              </button>
            </div>

            {clientMode === "existing" ? (
              <div className="space-y-3">
                <div className="relative" ref={clientDropdownRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setIsClientDropdownOpen((current) => !current)
                    }
                    disabled={isSubmitting}
                    aria-expanded={isClientDropdownOpen}
                    aria-controls="admin-client-dropdown"
                    className="flex w-full items-center justify-between rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] px-4 py-3 text-left outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
                  >
                    <AdminIcon icon={adminIcons.username} tone="secondary" />
                    <span
                      className={`mx-3 flex-1 truncate text-sm ${
                        selectedClient
                          ? "text-[var(--admin-text-primary)]"
                          : "text-[var(--admin-text-secondary)]"
                      }`}
                    >
                      {selectedClientLabel}
                    </span>
                    <span
                      className={`transition ${isClientDropdownOpen ? "rotate-90" : ""}`}
                      aria-hidden
                    >
                      <AdminIcon
                        icon={adminIcons.chevronRight}
                        tone="secondary"
                      />
                    </span>
                  </button>

                  {isClientDropdownOpen ? (
                    <div
                      id="admin-client-dropdown"
                      className="absolute z-20 mt-2 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg"
                    >
                      <label
                        className="relative block"
                        htmlFor="admin-client-search"
                      >
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
                          <AdminIcon
                            icon={adminIcons.username}
                            tone="secondary"
                          />
                        </span>
                        <input
                          id="admin-client-search"
                          value={searchQuery}
                          onChange={(event) =>
                            onSearchQueryChange(event.target.value)
                          }
                          placeholder={t(
                            "monthsDetail.bookModal.placeholders.searchClient",
                          )}
                          disabled={isSubmitting}
                          className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--admin-text-primary)] outline-none transition focus:border-[var(--admin-accent)]"
                        />
                      </label>

                      <div className="mt-2">
                        {isSearchingClients ? (
                          <p className="text-xs text-[var(--admin-text-secondary)]">
                            {t("monthsDetail.bookModal.searchingClients")}
                          </p>
                        ) : null}

                        {!isSearchingClients &&
                        searchQuery.trim().length >= 2 &&
                        searchResults.length === 0 ? (
                          <p className="text-xs text-[var(--admin-text-secondary)]">
                            {t("monthsDetail.bookModal.emptyClientResults")}
                          </p>
                        ) : null}

                        {searchResults.length > 0 ? (
                          <div className="max-h-44 space-y-2 overflow-y-auto">
                            {searchResults.map((client) => (
                              <button
                                key={client.clientId}
                                type="button"
                                onClick={() => {
                                  onSelectClient(client);
                                  setIsClientDropdownOpen(false);
                                }}
                                disabled={isSubmitting}
                                className={`w-full rounded-xl border p-3 text-left transition ${
                                  selectedClient?.clientId === client.clientId
                                    ? "border-transparent bg-[var(--admin-primary)] text-white"
                                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)]"
                                }`}
                              >
                                <p className="font-semibold">{client.name}</p>
                                <p
                                  className={`text-sm ${selectedClient?.clientId === client.clientId ? "text-white/90" : "text-[var(--admin-text-secondary)]"}`}
                                >
                                  #{client.clientNumber} ·{" "}
                                  {formatPhoneForDisplay(client.phone)}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {fieldErrors.client ? (
                  <p className="text-sm text-red-700">
                    {fieldErrors.client === "CLIENT_NUMBER_INVALID"
                      ? t("monthsDetail.bookModal.errors.clientNumberInvalid")
                      : t("monthsDetail.bookModal.errors.clientRequired")}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  id="admin-book-new-client-name"
                  value={newClientName}
                  onChange={(event) =>
                    onNewClientNameChange(event.target.value)
                  }
                  label={t("monthsDetail.bookModal.placeholders.newClientName")}
                  placeholder={t(
                    "monthsDetail.bookModal.placeholders.newClientName",
                  )}
                  disabled={isSubmitting}
                  icon={
                    <AdminIcon icon={adminIcons.username} tone="secondary" />
                  }
                  error={
                    fieldErrors.name
                      ? t("monthsDetail.bookModal.errors.nameRequired")
                      : null
                  }
                />
                <Input
                  id="admin-book-new-client-phone"
                  value={newClientPhone}
                  onChange={(event) =>
                    onNewClientPhoneChange(event.target.value)
                  }
                  label={t(
                    "monthsDetail.bookModal.placeholders.newClientPhone",
                  )}
                  placeholder={t(
                    "monthsDetail.bookModal.placeholders.newClientPhone",
                  )}
                  disabled={isSubmitting}
                  icon={<AdminIcon icon={adminIcons.phone} tone="secondary" />}
                  error={
                    fieldErrors.phone
                      ? t("monthsDetail.bookModal.errors.phoneRequired")
                      : null
                  }
                />
                <Input
                  id="admin-book-new-client-number"
                  value={newClientNumber}
                  onChange={(event) =>
                    onNewClientNumberChange(
                      event.target.value.replace(/\D/g, ""),
                    )
                  }
                  label={t(
                    "monthsDetail.bookModal.placeholders.newClientNumber",
                  )}
                  placeholder={t(
                    "monthsDetail.bookModal.placeholders.newClientNumber",
                  )}
                  inputMode="numeric"
                  disabled={isSubmitting}
                  icon={<AdminIcon icon={adminIcons.client} tone="secondary" />}
                  error={
                    fieldErrors.client === "CLIENT_NUMBER_INVALID"
                      ? t("monthsDetail.bookModal.errors.clientNumberInvalid")
                      : null
                  }
                />
              </div>
            )}
          </section>

          <Button
            type="button"
            fullWidth
            disabled={!isReadyToSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </BottomSheetModal>
  );
}

function CalendarSuccessIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--admin-accent)]">
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

function ClockSuccessIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--admin-accent)]">
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

function PhoneSuccessIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--admin-accent)]">
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="56"
      viewBox="0 0 24 24"
      width="56"
    >
      <path
        d="M6 12.75L10.25 17 18 8.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
