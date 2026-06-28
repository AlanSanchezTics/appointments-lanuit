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
});
