import { describe, expect, it } from "vitest";

import { parseAdminAppointmentLogsQuery } from "@/lib/admin/appointment-logs/validation";

describe("admin appointment logs validation", () => {
  it("parses month filters and defaults safely", () => {
    expect(
      parseAdminAppointmentLogsQuery({
        month: "2026-06",
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      client: "",
      actionType: null,
      month: "2026-06",
      actionDateFrom: null,
      actionDateTo: null,
      format: "json",
    });
  });

  it("rejects invalid month filters", () => {
    expect(() =>
      parseAdminAppointmentLogsQuery({
        month: "2026-13",
      }),
    ).toThrow("VALIDATION_ERROR");
  });
});
