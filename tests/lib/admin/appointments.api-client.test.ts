import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAdminAppointmentByMonth,
  fetchAdminDayAgenda,
} from "@/lib/admin/appointments/api-client";

describe("admin appointments api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends excludeAppointmentId to the day agenda only when provided", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({ month: "2026-03", date: "2026-03-21", total: 0, availableSlots: [], appointments: [], blockedSlots: [] }),
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAdminDayAgenda("2026-03", "2026-03-21");
    await fetchAdminDayAgenda("2026-03", "2026-03-21", undefined, 10);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/months/2026-03/days/2026-03-21/agenda");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/admin/months/2026-03/days/2026-03-21/agenda?excludeAppointmentId=10",
    );
  });

  it("normalizes inline client name before sending payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          appointmentId: 101,
          date: "2026-03-21",
          timeSlot: "14:00",
          status: "CONFIRMED",
          client: {
            clientId: 44,
            clientNumber: 1002,
            name: "Maria Perez",
            phone: "5511112233",
          },
        }),
        { status: 201 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await createAdminAppointmentByMonth({
      month: "2026-03",
      date: "2026-03-21",
      timeSlot: "14:00",
      client: {
        name: " Maria Perez ",
        phone: "5511112233",
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      client?: { name: string };
    };
    expect(payload.client?.name).toBe("Maria Perez");
  });
});
