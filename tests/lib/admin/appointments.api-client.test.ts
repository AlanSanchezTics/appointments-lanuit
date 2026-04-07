import { afterEach, describe, expect, it, vi } from "vitest";

import { createAdminAppointmentByMonth } from "@/lib/admin/appointments/api-client";

describe("admin appointments api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
