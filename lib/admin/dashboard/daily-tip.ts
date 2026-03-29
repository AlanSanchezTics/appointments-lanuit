import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

const DAILY_TIP_ANCHOR_DATE = "2026-03-29";
const TIP_FILE_BY_LANGUAGE: Record<AppLanguage, string> = {
  es: "tips_operativos_salon_unas.csv",
  en: "tips_operativos_salon_unas_en.csv",
};

export interface DailyTipSelection {
  title: string;
  content: string;
  index: number;
  total: number;
}

type TipsCatalog = {
  es: string[];
  en: string[];
};

let tipsCatalogCache: TipsCatalog | null = null;

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function parseTipsCsv(csvContent: string) {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    if (line.startsWith("\"") && line.endsWith("\"")) {
      return line.slice(1, -1).replace(/""/g, "\"");
    }

    return line;
  });
}

export function resolveDailyTipIndex(
  currentDateKey: string,
  totalTips: number,
  anchorDateKey = DAILY_TIP_ANCHOR_DATE,
) {
  if (totalTips <= 0) {
    throw new Error("DAILY_TIP_EMPTY_CATALOG");
  }

  const current = parseDateKey(currentDateKey).getTime();
  const anchor = parseDateKey(anchorDateKey).getTime();
  const millisecondsInDay = 24 * 60 * 60 * 1000;
  const dayOffset = Math.floor((current - anchor) / millisecondsInDay);

  return ((dayOffset % totalTips) + totalTips) % totalTips;
}

export function resolveDailyTipFromCatalog(
  catalog: TipsCatalog,
  language: AppLanguage,
  currentDateKey: string,
) {
  const baseTips = catalog.es;

  if (baseTips.length === 0) {
    throw new Error("DAILY_TIP_EMPTY_CATALOG");
  }

  const candidateTips =
    language === "en" && catalog.en.length === baseTips.length
      ? catalog.en
      : baseTips;
  const tipIndex = resolveDailyTipIndex(currentDateKey, candidateTips.length);

  return {
    title: language === "en" ? "Tip of the day" : "Tip del día",
    content: candidateTips[tipIndex],
    index: tipIndex + 1,
    total: candidateTips.length,
  } satisfies DailyTipSelection;
}

async function readTipsByLanguage(language: AppLanguage) {
  const fileName = TIP_FILE_BY_LANGUAGE[language];
  const absolutePath = path.join(process.cwd(), "assets", fileName);
  const content = await readFile(absolutePath, "utf-8");

  return parseTipsCsv(content);
}

export async function getTipsCatalog() {
  if (tipsCatalogCache) {
    return tipsCatalogCache;
  }

  const tipsEs = await readTipsByLanguage("es");
  let tipsEn: string[] = [];

  try {
    tipsEn = await readTipsByLanguage("en");
  } catch {
    tipsEn = [];
  }

  tipsCatalogCache = {
    es: tipsEs,
    en: tipsEn,
  };

  return tipsCatalogCache;
}

export async function getDailyTipSelection(language: AppLanguage, now = new Date()) {
  const currentDateKey = getCurrentDateKey(now);
  const catalog = await getTipsCatalog();

  return resolveDailyTipFromCatalog(catalog, language, currentDateKey);
}
