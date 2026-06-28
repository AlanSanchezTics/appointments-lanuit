import { z } from "zod";

import type { AdminAppointmentLogsQuery } from "@/lib/admin/appointment-logs/types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const ACTION_TYPES = ["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"] as const;
const EXPORT_FORMATS = ["json", "pdf"] as const;

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isValidDateKey(date: string) {
  if (!DATE_KEY_PATTERN.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isValidMonthKey(month: string) {
  if (!MONTH_KEY_PATTERN.test(month)) {
    return false;
  }

  const parsed = new Date(`${month}-01T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 7) === month;
}

function parseOptionalDateKey(value: string | undefined, field: string) {
  if (!value) {
    return null;
  }

  if (!isValidDateKey(value)) {
    throw new Error("VALIDATION_ERROR");
  }

  if (field === "actionDateFrom" || field === "actionDateTo") {
    return value;
  }

  return value;
}

function parseOptionalMonthKey(value: string | undefined) {
  if (!value) {
    return "";
  }

  if (!isValidMonthKey(value)) {
    throw new Error("VALIDATION_ERROR");
  }

  return value;
}

export function parseAdminAppointmentLogsQuery(
  searchParams: Record<string, string | string[] | undefined>,
): AdminAppointmentLogsQuery {
  const pageRaw = readParam(searchParams.page);
  const pageSizeRaw = readParam(searchParams.pageSize);
  const client = (readParam(searchParams.client) ?? "").trim();
  const actionTypeRaw = readParam(searchParams.actionType);
  const monthRaw = readParam(searchParams.month);
  const actionDateFromRaw = readParam(searchParams.actionDateFrom);
  const actionDateToRaw = readParam(searchParams.actionDateTo);
  const formatRaw = readParam(searchParams.format);

  const page = pageRaw ? Number(pageRaw) : 1;
  const pageSize = pageSizeRaw ? Number(pageSizeRaw) : 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error("VALIDATION_ERROR");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error("VALIDATION_ERROR");
  }

  const actionType = actionTypeRaw
    ? z.enum(ACTION_TYPES).parse(actionTypeRaw)
    : null;
  const month = parseOptionalMonthKey(monthRaw?.trim());

  const actionDateFrom = parseOptionalDateKey(actionDateFromRaw, "actionDateFrom");
  const actionDateTo = parseOptionalDateKey(actionDateToRaw, "actionDateTo");

  if (actionDateFrom && actionDateTo && actionDateFrom > actionDateTo) {
    throw new Error("VALIDATION_ERROR");
  }

  let format: AdminAppointmentLogsQuery["format"] = "json";

  if (formatRaw) {
    if (!EXPORT_FORMATS.includes(formatRaw as (typeof EXPORT_FORMATS)[number])) {
      throw new Error("UNSUPPORTED_EXPORT_FORMAT");
    }

    format = formatRaw as AdminAppointmentLogsQuery["format"];
  }

  return {
    page,
    pageSize,
    client,
    actionType,
    month,
    actionDateFrom,
    actionDateTo,
    format,
  };
}
