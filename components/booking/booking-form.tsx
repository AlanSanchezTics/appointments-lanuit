"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/i18n/translate";

type BookingFormProps = {
  selectedDate: string | null;
  selectedSlot: string | null;
};

export function BookingForm({ selectedDate, selectedSlot }: BookingFormProps) {
  const { t } = useTranslation(["common", "errors"]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [messageCode, setMessageCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate || !selectedSlot) {
      setMessageCode("FORM_INCOMPLETE");
      return;
    }

    startTransition(async () => {
      setMessageCode(null);

      const response = await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          date: selectedDate,
          timeSlot: selectedSlot,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        errorCode?: string;
      };

      if (!response.ok) {
        setMessageCode(payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR");
        return;
      }

      setMessageCode("SUCCESS");
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-[var(--muted)]"
          htmlFor="booking-name"
        >
          {t("booking.name")}
        </label>
        <input
          id="booking-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none ring-0"
          placeholder={t("booking.namePlaceholder")}
          required
        />
      </div>
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-[var(--muted)]"
          htmlFor="booking-phone"
        >
          {t("booking.phone")}
        </label>
        <input
          id="booking-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none ring-0"
          placeholder="5512345678"
          inputMode="tel"
          required
        />
      </div>
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? t("booking.wait") : t("booking.confirmAppointment")}
      </Button>
      {messageCode ? (
        <p className="text-sm text-[var(--accent-dark)]">
          {messageCode === "SUCCESS" ? t("booking.successTitle") : translateApiError(t, messageCode)}
        </p>
      ) : null}
    </form>
  );
}
