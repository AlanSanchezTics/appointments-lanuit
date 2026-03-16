import { findActiveMonth, listActiveMonths, reconcileActiveMonthsInDatabase } from "@/lib/db/active-months";
import { getCurrentMonthKey } from "@/lib/datetime/mexico-city";

const BOOKING_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DEFAULT_ACTIVE_MONTH_WINDOW_SIZE = 2;

function getWindowSize(rawValue = process.env.ACTIVE_MONTH_WINDOW_SIZE) {
  const parsed = Number(rawValue ?? DEFAULT_ACTIVE_MONTH_WINDOW_SIZE);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_ACTIVE_MONTH_WINDOW_SIZE;
  }

  return parsed;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));

  return next.toISOString().slice(0, 7);
}

function getWindowMonths(currentMonth: string, windowSize: number) {
  const months: string[] = [];
  let cursor = currentMonth;

  for (let index = 0; index < windowSize; index += 1) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }

  return months;
}

function isBookingMonthFormat(month: string) {
  return BOOKING_MONTH_PATTERN.test(month);
}

export async function assertMonthIsBookable(month: string, now = new Date()) {
  if (!isBookingMonthFormat(month)) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  const currentMonth = getCurrentMonthKey(now);

  if (month < currentMonth) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  const record = await findActiveMonth(month);

  if (!record || record.status !== "ACTIVE") {
    throw new Error("MONTH_NOT_ALLOWED");
  }
}

export async function listBookableMonths(now = new Date()) {
  const currentMonth = getCurrentMonthKey(now);
  const records = await listActiveMonths();

  return records
    .map((record) => record.month)
    .filter((month) => month >= currentMonth)
    .sort();
}

export async function reconcileActiveMonths(now = new Date(), windowSize = getWindowSize()) {
  const currentMonth = getCurrentMonthKey(now);
  const windowMonths = getWindowMonths(currentMonth, windowSize);

  await reconcileActiveMonthsInDatabase({
    currentMonth,
    windowMonths,
  });

  return {
    currentMonth,
    windowMonths,
    windowSize,
  };
}
