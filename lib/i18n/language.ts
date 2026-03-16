import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY, type AppLanguage, normalizeLanguage } from "@/lib/i18n/config";

function getCookieLanguage(rawCookie: string | undefined | null) {
  if (!rawCookie) {
    return null;
  }

  const chunks = rawCookie.split(";");

  for (const chunk of chunks) {
    const [rawKey, rawValue] = chunk.split("=");

    if (rawKey?.trim() !== LANGUAGE_COOKIE_KEY) {
      continue;
    }

    return normalizeLanguage(rawValue);
  }

  return null;
}

export function resolveServerLanguage(rawCookie: string | undefined | null): AppLanguage {
  return getCookieLanguage(rawCookie) ?? DEFAULT_LANGUAGE;
}

export function resolveClientLanguage(): AppLanguage {
  const fromCookie = getCookieLanguage(typeof document !== "undefined" ? document.cookie : undefined);

  if (fromCookie) {
    return fromCookie;
  }

  if (typeof window !== "undefined") {
    const fromStorage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_COOKIE_KEY));

    if (fromStorage) {
      return fromStorage;
    }

    const fromNavigator =
      normalizeLanguage(window.navigator.language) ??
      window.navigator.languages.map((value) => normalizeLanguage(value)).find(Boolean) ??
      null;

    if (fromNavigator) {
      return fromNavigator;
    }
  }

  return DEFAULT_LANGUAGE;
}

export function persistLanguage(language: AppLanguage) {
  if (typeof document !== "undefined") {
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=31536000; SameSite=Lax`;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_COOKIE_KEY, language);
  }
}
