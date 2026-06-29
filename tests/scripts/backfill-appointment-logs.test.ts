import { describe, expect, it } from "vitest";

describe("backfill appointment logs script", () => {
  it("maps CANCELLED appointments to CANCELLED log events", async () => {
    const { mapStatusToActionType } = await import(
      "@/scripts/backfill-appointment-logs.mjs"
    );

    expect(mapStatusToActionType("CANCELLED")).toBe("CANCELLED");
  });

  it("normalizes status values before mapping", async () => {
    const { mapStatusToActionType } = await import(
      "@/scripts/backfill-appointment-logs.mjs"
    );

    expect(mapStatusToActionType(" cancelled ")).toBe("CANCELLED");
  });

  it("builds payload with appointment snapshot", async () => {
    const { buildAppointmentPayload } = await import(
      "@/scripts/backfill-appointment-logs.mjs"
    );

    const payload = buildAppointmentPayload({
      date: new Date("2026-06-01T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T15:30:00.000Z"),
    });

    expect(payload).toEqual({
      appointment: {
        date: "2026-06-01",
        timeSlot: "15:30",
      },
    });
  });
});
