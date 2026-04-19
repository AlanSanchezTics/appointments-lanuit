import { afterEach, describe, expect, it, vi } from "vitest";

import {
  releaseReservationLockByBeacon,
  submitBookingDraft,
} from "@/lib/booking/api-client";

describe("booking api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normalizes name before sending confirm payload", async () => {
    vi.stubEnv("NODE_ENV", "development");
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

  it("sends a beacon payload for lock release on exit", async () => {
    const sendBeaconMock = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    const sent = releaseReservationLockByBeacon(" lock-123 ");

    expect(sent).toBe(true);
    expect(sendBeaconMock).toHaveBeenCalledOnce();
    expect(sendBeaconMock).toHaveBeenCalledWith(
      "/api/reservar/lock/release-beacon",
      JSON.stringify({ lockToken: "lock-123" }),
    );
  });

  it("returns false when beacon API is unavailable", () => {
    vi.stubGlobal("navigator", {});

    const sent = releaseReservationLockByBeacon("lock-123");

    expect(sent).toBe(false);
  });
});
