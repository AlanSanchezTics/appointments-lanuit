import type { TFunction } from "i18next";

export function translateApiError(t: TFunction, code: string) {
  return t(`api.${code}`, { ns: "errors", defaultValue: t("api.UNKNOWN_ERROR", { ns: "errors" }) });
}

export function translateValidationError(t: TFunction, code: string) {
  return t(`validation.${code}`, {
    ns: "errors",
    defaultValue: t("validation.FORM_INCOMPLETE", { ns: "errors" }),
  });
}
