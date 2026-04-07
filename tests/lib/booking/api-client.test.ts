import { afterEach, describe, expect, it, vi } from "vitest";

import { submitBookingDraft } from "@/lib/booking/api-client";

describe("booking api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes name before sending confirm payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          appointmentId: 1,
          status: "CONFIRMED",
          whatsappPhone: "5215512345678",
          whatsappData: {
            name: "Ana",
            date: "2026-05-06",
            timeSlot: "18:00",
          },
        }),
        { status: 201 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await submitBookingDraft(
      {
        name: " Ana ",
        phone: "5512345678",
        date: "2026-05-06",
        timeSlot: "18:00",
      },
      "lock-123",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as { name: string };
    expect(payload.name).toBe("Ana");
  });
});
