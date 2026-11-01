import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import {
  AffectedAppointmentsConfirmationError,
  getAvailabilityForMonth,
  previewAvailability,
  saveAvailability,
} from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Misma técnica que api-admin-month-slot-mode-route: la ruta hace instanceof sobre la clase real.
vi.mock("@/lib/admin/months/service", () => {
  class AffectedAppointmentsConfirmationError extends Error {
    readonly affectedAppointments: unknown[];

    constructor(affectedAppointments: unknown[]) {
      super("AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED");
      this.name = "AffectedAppointmentsConfirmationError";
      this.affectedAppointments = affectedAppointments;
    }
  }

  return {
    AffectedAppointmentsConfirmationError,
    getAvailabilityForMonth: vi.fn(),
    previewAvailability: vi.fn(),
    saveAvailability: vi.fn(),
  };
});

const authMock = vi.mocked(auth);
const getAvailabilityMock = vi.mocked(getAvailabilityForMonth);
const previewMock = vi.mocked(previewAvailability);
const saveMock = vi.mocked(saveAvailability);

const MONTH = "2026-12";
const params = { params: Promise.resolve({ month: MONTH }) };

const RULE = {
  startDate: "2026-12-01",
  endDate: "2026-12-13",
  weekdays: [1, 2, 3, 4, 5],
  times: ["09:00", "10:00", "13:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

const EXCEPTION = {
  date: "2026-12-19",
  times: ["10:00", "14:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

const SAVE_BODY = {
  expectedVersion: 3,
  rules: [RULE],
  exceptions: [EXCEPTION],
  confirmAffectedAppointments: false,
};

const AFFECTED = [
  { appointmentId: 87, date: "2026-12-03", timeSlot: "17:00", status: "CONFIRMED", clientName: "Nombre de ejemplo" },
];

function authorized() {
  authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
}

function unauthorized() {
  authMock.mockResolvedValueOnce(null as never);
}

function jsonRequest(method: string, body?: unknown) {
  return new Request(`http://localhost/api/admin/months/${MONTH}/availability`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/admin/months/[month]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    unauthorized();
    const { GET } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await GET(jsonRequest("GET"), params);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ errorCode: "ADMIN_UNAUTHORIZED", error: "ADMIN_UNAUTHORIZED" });
    expect(getAvailabilityMock).not.toHaveBeenCalled();
  });

  it("returns 404 MONTH_NOT_REGISTERED when the month is not registered", async () => {
    authorized();
    getAvailabilityMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const { GET } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await GET(jsonRequest("GET"), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTH_NOT_REGISTERED", error: "MONTH_NOT_REGISTERED" });
  });

  it("returns 400 MONTHS_INVALID_FORMAT for a malformed month without calling the service", async () => {
    authorized();
    const { GET } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await GET(
      jsonRequest("GET"),
      { params: Promise.resolve({ month: "2026-13" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTHS_INVALID_FORMAT", error: "MONTHS_INVALID_FORMAT" });
    expect(getAvailabilityMock).not.toHaveBeenCalled();
  });

  it("returns 200 with rules, exceptions, availabilityVersion, slotMode and usesDefaultRule", async () => {
    authorized();
    getAvailabilityMock.mockResolvedValueOnce({
      month: MONTH,
      availabilityVersion: 3,
      slotMode: "BLOCK_MODE",
      rules: [{ id: 11, ...RULE }],
      exceptions: [{ id: 4, ...EXCEPTION, times: ["10:00", "14:00"] }],
      usesDefaultRule: false,
    } as never);
    const { GET } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await GET(jsonRequest("GET"), params);

    expect(response.status).toBe(200);
    expect(getAvailabilityMock).toHaveBeenCalledWith(MONTH);
    await expect(response.json()).resolves.toMatchObject({
      month: MONTH,
      availabilityVersion: 3,
      slotMode: "BLOCK_MODE",
      usesDefaultRule: false,
      rules: [expect.objectContaining({ id: 11, weekdays: [1, 2, 3, 4, 5], times: ["09:00", "10:00", "13:00"] })],
      exceptions: [expect.objectContaining({ id: 4, date: "2026-12-19" })],
    });
  });
});

describe("PUT /api/admin/months/[month]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    unauthorized();
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(401);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("passes the parsed payload to the service and returns 200 with the new availabilityVersion", async () => {
    authorized();
    saveMock.mockResolvedValueOnce({
      month: MONTH,
      availabilityVersion: 4,
      slotMode: "BLOCK_MODE",
      rules: [{ id: 12, ...RULE }],
      exceptions: [{ id: 5, ...EXCEPTION }],
      usesDefaultRule: false,
    } as never);
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(MONTH, {
      rules: [RULE],
      exceptions: [EXCEPTION],
      expectedVersion: 3,
      confirmAffectedAppointments: false,
    });
    await expect(response.json()).resolves.toMatchObject({ availabilityVersion: 4, slotMode: "BLOCK_MODE" });
  });

  it("forwards confirmAffectedAppointments=true to the service", async () => {
    authorized();
    saveMock.mockResolvedValueOnce({ month: MONTH, availabilityVersion: 4 } as never);
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    await PUT(jsonRequest("PUT", { ...SAVE_BODY, confirmAffectedAppointments: true }), params);

    expect(saveMock).toHaveBeenCalledWith(MONTH, expect.objectContaining({ confirmAffectedAppointments: true }));
  });

  it("returns 404 MONTH_NOT_REGISTERED when the month is not registered", async () => {
    authorized();
    saveMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTH_NOT_REGISTERED", error: "MONTH_NOT_REGISTERED" });
  });

  it("returns 422 MONTH_IN_PAST for a past month (FR-021, D36)", async () => {
    authorized();
    saveMock.mockRejectedValueOnce(new Error("MONTH_IN_PAST"));
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTH_IN_PAST", error: "MONTH_IN_PAST" });
  });

  it("returns 409 AVAILABILITY_VERSION_CONFLICT when expectedVersion is stale (FR-041)", async () => {
    authorized();
    saveMock.mockRejectedValueOnce(new Error("AVAILABILITY_VERSION_CONFLICT"));
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "AVAILABILITY_VERSION_CONFLICT",
      error: "AVAILABILITY_VERSION_CONFLICT",
    });
  });

  it("returns 409 with affectedCount and affectedAppointments when confirmation is required", async () => {
    authorized();
    saveMock.mockRejectedValueOnce(new AffectedAppointmentsConfirmationError(AFFECTED));
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
      error: "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
      affectedCount: 1,
      affectedAppointments: AFFECTED,
    });
  });

  it.each([
    "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    "AVAILABILITY_RULE_RANGE_INVALID",
    "AVAILABILITY_RULE_OVERLAP",
    "AVAILABILITY_RULE_WEEKDAYS_REQUIRED",
    "AVAILABILITY_RULE_TIMES_REQUIRED",
    "AVAILABILITY_TIME_INVALID",
    "AVAILABILITY_MIN_GAP_OUT_OF_RANGE",
    "AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE",
    "AVAILABILITY_TIMES_LIMIT_EXCEEDED",
    "AVAILABILITY_EXCEPTION_DATE_DUPLICATE",
    "AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH",
  ])("returns 400 with the stable code %s and writes nothing", async (code) => {
    authorized();
    saveMock.mockRejectedValueOnce(new Error(code));
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", SAVE_BODY), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: code, error: code });
  });

  it("returns 400 VALIDATION_ERROR when expectedVersion is missing, without calling the service", async () => {
    authorized();
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");
    const withoutVersion: Partial<typeof SAVE_BODY> = { ...SAVE_BODY };
    delete withoutVersion.expectedVersion;

    const response = await PUT(jsonRequest("PUT", withoutVersion), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: "VALIDATION_ERROR", error: "VALIDATION_ERROR" });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not JSON, without calling the service", async () => {
    authorized();
    const { PUT } = await import("@/app/api/admin/months/[month]/availability/route");

    const response = await PUT(jsonRequest("PUT", "{no-json"), params);

    expect(response.status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/months/[month]/availability/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PREVIEW_BODY = { rules: [RULE], exceptions: [EXCEPTION] };

  it("returns 401 when there is no admin session", async () => {
    unauthorized();
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(jsonRequest("POST", PREVIEW_BODY), params);

    expect(response.status).toBe(401);
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("returns 200 with affectedCount and affectedAppointments and does not write", async () => {
    authorized();
    previewMock.mockResolvedValueOnce({ affectedCount: 1, affectedAppointments: AFFECTED } as never);
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(jsonRequest("POST", PREVIEW_BODY), params);

    expect(response.status).toBe(200);
    expect(previewMock).toHaveBeenCalledWith(MONTH, { rules: [RULE], exceptions: [EXCEPTION] });
    expect(saveMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ affectedCount: 1, affectedAppointments: AFFECTED });
  });

  it("does not block a past month: the service result is returned as-is (D70)", async () => {
    authorized();
    previewMock.mockResolvedValueOnce({ affectedCount: 0, affectedAppointments: [] } as never);
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(
      jsonRequest("POST", PREVIEW_BODY),
      { params: Promise.resolve({ month: "2025-01" }) },
    );

    expect(response.status).toBe(200);
    expect(previewMock).toHaveBeenCalledWith("2025-01", expect.any(Object));
  });

  it("returns 404 MONTH_NOT_REGISTERED when the month is not registered", async () => {
    authorized();
    previewMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(jsonRequest("POST", PREVIEW_BODY), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTH_NOT_REGISTERED", error: "MONTH_NOT_REGISTERED" });
  });

  it.each([
    "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    "AVAILABILITY_RULE_OVERLAP",
    "AVAILABILITY_TIME_INVALID",
    "AVAILABILITY_EXCEPTION_DATE_DUPLICATE",
  ])("returns 400 with the stable code %s", async (code) => {
    authorized();
    previewMock.mockRejectedValueOnce(new Error(code));
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(jsonRequest("POST", PREVIEW_BODY), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: code, error: code });
  });

  it("returns 400 VALIDATION_ERROR when rules is not an array, without calling the service", async () => {
    authorized();
    const { POST } = await import("@/app/api/admin/months/[month]/availability/preview/route");

    const response = await POST(jsonRequest("POST", { rules: "x", exceptions: [] }), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: "VALIDATION_ERROR", error: "VALIDATION_ERROR" });
    expect(previewMock).not.toHaveBeenCalled();
  });
});
