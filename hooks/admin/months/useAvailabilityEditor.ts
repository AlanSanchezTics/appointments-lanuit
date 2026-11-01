"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { fetchAdminMonthAvailability } from "@/lib/admin/months/api-client";
import type {
  AvailabilityExceptionBody,
  AvailabilityRuleBody,
  MonthAvailabilityResponse,
  PreviewAvailabilityPayload,
} from "@/lib/admin/months/types";
import { DEFAULT_DAY_RULE } from "@/lib/availability/defaults";
import { normalizeAvailabilityConfig } from "@/lib/availability/rules-validation";
import type { AvailabilityException, AvailabilityRule } from "@/lib/availability/types";

// Borrador del editor (T041). La clave local solo sirve a React; nunca se envía a la API.
export type EditorRule = AvailabilityRuleBody & { key: string };
export type EditorException = AvailabilityExceptionBody & { key: string };

export type DraftValidation = {
  ruleErrors: Record<string, string>;
  exceptionErrors: Record<string, string>;
  configErrorCode: string | null;
};

// D10/A2: parámetros propios de una excepción nueva. Días de regla nueva: lunes a viernes (D6).
const NEW_EXCEPTION_PARAMETERS = { minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 } as const;
const NEW_RULE_WEEKDAYS = [1, 2, 3, 4, 5];

let draftKeySequence = 0;

function nextDraftKey() {
  draftKeySequence += 1;
  return `availability-draft-${draftKeySequence}`;
}

// FR: el rango de fechas de cualquier regla o excepción queda dentro del mes (rules-validation lo exige).
export function getMonthDateBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    first: `${month}-01`,
    last: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function pickRuleBody(rule: AvailabilityRuleBody): AvailabilityRuleBody {
  return {
    startDate: rule.startDate,
    endDate: rule.endDate,
    weekdays: [...rule.weekdays],
    times: [...rule.times],
    minGapMinutes: rule.minGapMinutes,
    preserveCapacity: rule.preserveCapacity,
    maxPerDay: rule.maxPerDay,
  };
}

function pickExceptionBody(exception: AvailabilityExceptionBody): AvailabilityExceptionBody {
  return {
    date: exception.date,
    times: [...exception.times],
    minGapMinutes: exception.minGapMinutes,
    preserveCapacity: exception.preserveCapacity,
    maxPerDay: exception.maxPerDay,
  };
}

function toEditorRules(rules: AvailabilityRule[]): EditorRule[] {
  return rules.map((rule) => ({ key: nextDraftKey(), ...pickRuleBody(rule) }));
}

function toEditorExceptions(exceptions: AvailabilityException[]): EditorException[] {
  return exceptions.map((exception) => ({ key: nextDraftKey(), ...pickExceptionBody(exception) }));
}

export function toPreviewPayload(rules: EditorRule[], exceptions: EditorException[]): PreviewAvailabilityPayload {
  return {
    rules: rules.map(pickRuleBody),
    exceptions: exceptions.map(pickExceptionBody),
  };
}

function createEditorRule(month: string): EditorRule {
  const bounds = getMonthDateBounds(month);

  return {
    key: nextDraftKey(),
    startDate: bounds.first,
    endDate: bounds.last,
    weekdays: [...NEW_RULE_WEEKDAYS],
    times: [...DEFAULT_DAY_RULE.times],
    minGapMinutes: DEFAULT_DAY_RULE.minGapMinutes,
    preserveCapacity: DEFAULT_DAY_RULE.preserveCapacity,
    maxPerDay: DEFAULT_DAY_RULE.maxPerDay,
  };
}

// Horas vacías = día cerrado (A2); el formulario lo muestra como aviso.
function createEditorException(month: string): EditorException {
  return {
    key: nextDraftKey(),
    date: getMonthDateBounds(month).first,
    times: [],
    ...NEW_EXCEPTION_PARAMETERS,
  };
}

export function readAvailabilityErrorCode(error: unknown) {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}

function findErrorCode(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return readAvailabilityErrorCode(error);
  }
}

// Validación espejo (FR-025): reutiliza el motor, no repite reglas. Por ítem primero; traslapes y fechas
// duplicadas solo se ven con el conjunto completo, así que se comprueban cuando todos los ítems son válidos.
export function validateAvailabilityDraft(
  month: string,
  rules: EditorRule[],
  exceptions: EditorException[],
): DraftValidation {
  const ruleErrors: Record<string, string> = {};
  const exceptionErrors: Record<string, string> = {};

  for (const rule of rules) {
    const code = findErrorCode(() =>
      normalizeAvailabilityConfig({ month, rules: [pickRuleBody(rule)], exceptions: [] }),
    );

    if (code) {
      ruleErrors[rule.key] = code;
    }
  }

  for (const exception of exceptions) {
    const code = findErrorCode(() =>
      normalizeAvailabilityConfig({ month, rules: [], exceptions: [pickExceptionBody(exception)] }),
    );

    if (code) {
      exceptionErrors[exception.key] = code;
    }
  }

  const hasItemErrors = Object.keys(ruleErrors).length > 0 || Object.keys(exceptionErrors).length > 0;
  const configErrorCode = hasItemErrors
    ? null
    : findErrorCode(() =>
        normalizeAvailabilityConfig({
          month,
          rules: rules.map(pickRuleBody),
          exceptions: exceptions.map(pickExceptionBody),
        }),
      );

  return { ruleErrors, exceptionErrors, configErrorCode };
}

// Código de error de la API o de la validación espejo -> clave de i18n (monthsDetail.availability.errors.*).
const AVAILABILITY_ERROR_KEYS: Record<string, string> = {
  AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH: "monthsDetail.availability.errors.rangeOutsideMonth",
  AVAILABILITY_RULE_RANGE_INVALID: "monthsDetail.availability.errors.rangeInvalid",
  AVAILABILITY_RULE_OVERLAP: "monthsDetail.availability.errors.ruleOverlap",
  AVAILABILITY_RULE_WEEKDAYS_REQUIRED: "monthsDetail.availability.errors.weekdaysRequired",
  AVAILABILITY_RULE_TIMES_REQUIRED: "monthsDetail.availability.errors.timesRequired",
  AVAILABILITY_TIME_INVALID: "monthsDetail.availability.errors.timeInvalid",
  AVAILABILITY_MIN_GAP_OUT_OF_RANGE: "monthsDetail.availability.errors.minGapOutOfRange",
  AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE: "monthsDetail.availability.errors.maxPerDayOutOfRange",
  AVAILABILITY_TIMES_LIMIT_EXCEEDED: "monthsDetail.availability.errors.timesLimitExceeded",
  AVAILABILITY_EXCEPTION_DATE_DUPLICATE: "monthsDetail.availability.errors.exceptionDateDuplicate",
  AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH: "monthsDetail.availability.errors.exceptionDateOutsideMonth",
  AVAILABILITY_VERSION_CONFLICT: "monthsDetail.availability.errors.versionConflict",
  AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED: "monthsDetail.availability.errors.affectedConfirmationRequired",
  MONTH_NOT_REGISTERED: "monthsDetail.availability.errors.monthNotRegistered",
  MONTH_IN_PAST: "monthsDetail.availability.errors.monthInPast",
  VALIDATION_ERROR: "monthsDetail.availability.errors.invalidRequest",
};

export function resolveAvailabilityErrorKey(code: string) {
  return AVAILABILITY_ERROR_KEYS[code] ?? "monthsDetail.availability.errors.unknown";
}

export function useAvailabilityEditor(month: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState<number | null>(null);
  const [rules, setRules] = useState<EditorRule[]>([]);
  const [exceptions, setExceptions] = useState<EditorException[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const payload = useMemo(() => toPreviewPayload(rules, exceptions), [rules, exceptions]);
  const validation = useMemo(
    () => validateAvailabilityDraft(month, rules, exceptions),
    [month, rules, exceptions],
  );
  const isDirty = JSON.stringify(payload) !== savedSnapshot;
  const isValid =
    Object.keys(validation.ruleErrors).length === 0
    && Object.keys(validation.exceptionErrors).length === 0
    && validation.configErrorCode === null;
  // D6/D17: sin reglas el mes usa el horario por defecto.
  const usesDefaultRule = rules.length === 0;

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setLoadErrorCode(null);

    try {
      const response: MonthAvailabilityResponse = await fetchAdminMonthAvailability(month, controller.signal);
      const nextRules = toEditorRules(response.rules);
      const nextExceptions = toEditorExceptions(response.exceptions);

      setAvailabilityVersion(response.availabilityVersion);
      setRules(nextRules);
      setExceptions(nextExceptions);
      setSavedSnapshot(JSON.stringify(toPreviewPayload(nextRules, nextExceptions)));
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setLoadErrorCode(readAvailabilityErrorCode(error));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [month]);

  const open = useCallback(async () => {
    setIsOpen(true);
    setIsDiscardConfirmOpen(false);
    await load();
  }, [load]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsOpen(false);
    setIsLoading(false);
    setLoadErrorCode(null);
    setAvailabilityVersion(null);
    setRules([]);
    setExceptions([]);
    setSavedSnapshot("");
    setIsDiscardConfirmOpen(false);
  }, []);

  // Con cambios sin guardar pide confirmación antes de cerrar.
  const requestClose = useCallback(() => {
    if (isDirty) {
      setIsDiscardConfirmOpen(true);
      return;
    }

    close();
  }, [close, isDirty]);

  const keepEditing = useCallback(() => setIsDiscardConfirmOpen(false), []);

  const addRule = useCallback(() => {
    setRules((current) => [...current, createEditorRule(month)]);
  }, [month]);

  const updateRule = useCallback((key: string, patch: Partial<AvailabilityRuleBody>) => {
    setRules((current) => current.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)));
  }, []);

  const removeRule = useCallback((key: string) => {
    setRules((current) => current.filter((rule) => rule.key !== key));
  }, []);

  const addException = useCallback(() => {
    setExceptions((current) => [...current, createEditorException(month)]);
  }, [month]);

  const updateException = useCallback((key: string, patch: Partial<AvailabilityExceptionBody>) => {
    setExceptions((current) =>
      current.map((exception) => (exception.key === key ? { ...exception, ...patch } : exception)),
    );
  }, []);

  const removeException = useCallback((key: string) => {
    setExceptions((current) => current.filter((exception) => exception.key !== key));
  }, []);

  return {
    isOpen,
    isLoading,
    loadErrorCode,
    availabilityVersion,
    rules,
    exceptions,
    payload,
    isDirty,
    isValid,
    usesDefaultRule,
    ruleErrors: validation.ruleErrors,
    exceptionErrors: validation.exceptionErrors,
    configErrorCode: validation.configErrorCode,
    isDiscardConfirmOpen,
    open,
    retry: load,
    close,
    requestClose,
    keepEditing,
    addRule,
    updateRule,
    removeRule,
    addException,
    updateException,
    removeException,
  };
}

export type AvailabilityEditorApi = ReturnType<typeof useAvailabilityEditor>;
