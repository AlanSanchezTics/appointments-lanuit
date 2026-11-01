import { describe, expect, it } from "vitest";

import { normalizeErrorCode } from "@/lib/api/error-response";
import { myAppointmentsRescheduleSchema } from "@/lib/validation/my-appointments";

const base = {
  phone: "5512345678",
  appointmentId: 7,
  timeSlot: "14:00",
};

function codeOf(date: string, month = date.slice(0, 7)) {
  try {
    myAppointmentsRescheduleSchema.parse({ ...base, month, date });
    return "NO_ERROR";
  } catch (error) {
    return normalizeErrorCode(error);
  }
}

describe("my appointments reschedule validation (B2)", () => {
  it("rejects impossible calendar dates as VALIDATION_ERROR", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-04-31"]) {
      expect(codeOf(date), date).toBe("VALIDATION_ERROR");
    }
  });

  it("accepts real calendar dates, including leap days", () => {
    expect(codeOf("2028-02-29")).toBe("NO_ERROR");
    expect(codeOf("2026-03-31")).toBe("NO_ERROR");
  });
});
