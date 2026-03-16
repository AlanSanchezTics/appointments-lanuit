import { ZodError } from "zod";

const CODE_PATTERN = /^[A-Z0-9_]+$/;

export function normalizeErrorCode(error: unknown) {
  if (error instanceof ZodError) {
    return "VALIDATION_ERROR";
  }

  if (error instanceof Error && CODE_PATTERN.test(error.message)) {
    return error.message;
  }

  return "UNKNOWN_ERROR";
}

export function buildErrorPayload(code: string) {
  return {
    errorCode: code,
    error: code,
  };
}
