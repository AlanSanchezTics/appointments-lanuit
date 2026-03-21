"use client";

import { CancelLookupStep } from "@/components/cancel/cancel-lookup-step";
import { CancelReviewStep } from "@/components/cancel/cancel-review-step";
import { CancelSuccessStep } from "@/components/cancel/cancel-success-step";
import { useCancelFlow } from "@/hooks/cancel/use-cancel-flow";
import {
  translateApiError,
  translateValidationError,
} from "@/lib/i18n/translate";
import type { AppLanguage } from "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

export function CancelForm() {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  const {
    step,
    phone,
    appointment,
    lookupErrorCode,
    cancelErrorCode,
    isSearching,
    isCancelling,
    setPhone,
    handleLookup,
    handleCancel,
    handleReset,
  } = useCancelFlow();

  const lookupError = lookupErrorCode
    ? lookupErrorCode === "PHONE_INVALID"
      ? translateValidationError(t, lookupErrorCode)
      : translateApiError(t, lookupErrorCode)
    : null;

  const cancelError = cancelErrorCode
    ? translateApiError(t, cancelErrorCode)
    : null;

  return (
    <section className="booking-mobile-shell p-6 md:p-6 min-h-screen flex items-center justify-center">
      <div className="w-full">
        {step === "lookup" ? (
          <CancelLookupStep
            phone={phone}
            lookupError={lookupError}
            isSearching={isSearching}
            onPhoneChange={setPhone}
            onLookupSubmit={handleLookup}
            t={t}
          />
        ) : null}

        {step === "review" && appointment ? (
          <CancelReviewStep
            appointment={appointment}
            cancelError={cancelError}
            isCancelling={isCancelling}
            language={language}
            onCancel={handleCancel}
            onReset={handleReset}
            t={t}
          />
        ) : null}

        {step === "success" ? <CancelSuccessStep t={t} /> : null}
      </div>
    </section>
  );
}
