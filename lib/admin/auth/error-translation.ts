const KNOWN_ADMIN_AUTH_ERROR_CODES = [
  "FORM_INCOMPLETE",
  "INVALID_CREDENTIALS",
  "ADMIN_USER_INACTIVE",
] as const;

export type AdminAuthErrorCode =
  | (typeof KNOWN_ADMIN_AUTH_ERROR_CODES)[number]
  | "UNKNOWN_ERROR";

export type AdminAuthErrorTranslationKey = `auth.${AdminAuthErrorCode}`;

function isKnownAdminAuthErrorCode(value: string): value is (typeof KNOWN_ADMIN_AUTH_ERROR_CODES)[number] {
  return KNOWN_ADMIN_AUTH_ERROR_CODES.includes(
    value as (typeof KNOWN_ADMIN_AUTH_ERROR_CODES)[number]
  );
}

export function resolveAdminAuthErrorKey(rawCode: string | null | undefined): AdminAuthErrorTranslationKey {
  if (!rawCode) {
    return "auth.UNKNOWN_ERROR";
  }

  if (isKnownAdminAuthErrorCode(rawCode)) {
    return `auth.${rawCode}`;
  }

  return "auth.UNKNOWN_ERROR";
}
