import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminMonthApiError,
  fetchAdminMonthAvailability,
  previewAdminMonthAvailability,
  saveAdminMonthAvailability,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/api-client";

function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof mockFetchJson>) {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("admin month api-client (availability)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCH slot-mode sends expectedVersion and confirmAffectedAppointments", async () => {
    const fetchMock = mockFetchJson({ month: "2026-12", slotMode: "SECOND_ONLY_MODE", availabilityVersion: 4 });

    await updateAdminMonthSlotMode("2026-12", "SECOND_ONLY_MODE", {
      expectedVersion: 3,
      confirmAffectedAppointments: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/months/2026-12/slot-mode");
    expect(init.method).toBe("PATCH");
    expect(requestBody(fetchMock)).toEqual({
      slotMode: "SECOND_ONLY_MODE",
      expectedVersion: 3,
      confirmAffectedAppointments: true,
    });
  });

  it("PATCH slot-mode without options keeps the legacy body (no expectedVersion, confirm false)", async () => {
    const fetchMock = mockFetchJson({ month: "2026-12", slotMode: "BLOCK_MODE", availabilityVersion: 4 });

    await updateAdminMonthSlotMode("2026-12", "BLOCK_MODE");

    expect(requestBody(fetchMock)).toEqual({ slotMode: "BLOCK_MODE", confirmAffectedAppointments: false });
  });

  it("PATCH slot-mode 409 keeps the error code as message and carries affected appointments", async () => {
    mockFetchJson(
      {
        errorCode: "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
        affectedCount: 1,
        affectedAppointments: [
          { appointmentId: 87, date: "2026-12-03", timeSlot: "17:00", status: "CONFIRMED", clientName: "Ana" },
        ],
      },
      409,
    );

    const error = await updateAdminMonthSlotMode("2026-12", "BLOCK_MODE").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminMonthApiError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED");
    expect((error as AdminMonthApiError).affectedAppointments).toHaveLength(1);
  });

  it("GET availability calls the availability route", async () => {
    const fetchMock = mockFetchJson({ month: "2026-12", availabilityVersion: 3, rules: [], exceptions: [] });

    await fetchAdminMonthAvailability("2026-12");

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/admin/months/2026-12/availability");
  });

  it("POST preview sends only rules and exceptions", async () => {
    const fetchMock = mockFetchJson({ affectedCount: 0, affectedAppointments: [] });
    const payload = { rules: [], exceptions: [] };

    await previewAdminMonthAvailability("2026-12", payload);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/months/2026-12/availability/preview");
    expect(init.method).toBe("POST");
    expect(requestBody(fetchMock)).toEqual(payload);
  });

  it("PUT availability sends expectedVersion and confirmAffectedAppointments", async () => {
    const fetchMock = mockFetchJson({ month: "2026-12", availabilityVersion: 4, rules: [], exceptions: [] });
    const payload = {
      rules: [],
      exceptions: [],
      expectedVersion: 3,
      confirmAffectedAppointments: true,
    };

    await saveAdminMonthAvailability("2026-12", payload);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/months/2026-12/availability");
    expect(init.method).toBe("PUT");
    expect(requestBody(fetchMock)).toEqual(payload);
  });

  it("maps a failed response without JSON to UNKNOWN_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => {
          throw new SyntaxError("no json");
        },
      })),
    );

    const error = await fetchAdminMonthAvailability("2026-12").catch((caught: unknown) => caught);

    expect((error as Error).message).toBe("UNKNOWN_ERROR");
  });
});
