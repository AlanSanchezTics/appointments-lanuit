import { describe, expect, it } from "vitest";

import { DEFAULT_MONTH_SLOT_MODE } from "@/lib/availability/month-slot-mode";

describe("month slot mode", () => {
  it("uses BLOCK_MODE as default month slot mode", () => {
    expect(DEFAULT_MONTH_SLOT_MODE).toBe("BLOCK_MODE");
  });
});
