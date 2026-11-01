import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import {
  AffectedAppointmentsConfirmationError,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// La fábrica replica la clase real: la ruta hace instanceof sobre ella para armar el 409 con la lista.
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
    updateAdminMonthSlotMode: vi.fn(),
    AffectedAppointmentsConfirmationError,
  };
});

const authMock = vi.mocked(auth);
const updateAdminMonthSlotModeMock = vi.mocked(updateAdminMonthSlotMode);

describe("PATCH /api/admin/months/[month]/slot-mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 404 when month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_NOT_REGISTERED",
      error: "MONTH_NOT_REGISTERED",
    });
  });

  it("returns 422 when trying to update a past month", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(new Error("MONTH_IN_PAST"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_IN_PAST",
      error: "MONTH_IN_PAST",
    });
  });

  it("updates month slot mode when payload is valid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthSlotModeMock.mockResolvedValueOnce({
      month: "2026-05",
      availabilityVersion: 4,
    });

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(200);
    expect(updateAdminMonthSlotModeMock).toHaveBeenCalledWith(
      "2026-05",
      expect.objectContaining({ slotMode: "SECOND_ONLY_MODE" }),
    );
    await expect(response.json()).resolves.toEqual({
      month: "2026-05",
      availabilityVersion: 4,
    });
  });

  it("returns 409 with the affected appointments when confirmation is required (D18, D45)", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    const affectedAppointments = [
      { appointmentId: 87, date: "2026-05-04", timeSlot: "17:00", status: "CONFIRMED", clientName: "Ana" },
    ];
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(
      new AffectedAppointmentsConfirmationError(affectedAppointments),
    );

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
      error: "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
      affectedCount: 1,
      affectedAppointments,
    });
  });

  it("returns 409 when expectedVersion is stale (FR-041)", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(new Error("AVAILABILITY_VERSION_CONFLICT"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE", expectedVersion: 2 }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "AVAILABILITY_VERSION_CONFLICT",
      error: "AVAILABILITY_VERSION_CONFLICT",
    });
  });
});

