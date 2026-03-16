import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { initializeClientI18n } from "@/lib/i18n/client";

initializeClientI18n("es");

beforeEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("app_lang", "es");
    document.cookie = "app_lang=es; path=/";
  }
});
