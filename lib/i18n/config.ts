export const LANGUAGE_COOKIE_KEY = "app_lang";

export const SUPPORTED_LANGUAGES = ["es", "en"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "es";

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGES);

export function isSupportedLanguage(value: string): value is AppLanguage {
  return SUPPORTED_SET.has(value);
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (isSupportedLanguage(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("es")) {
    return "es";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return null;
}
