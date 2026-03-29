import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminAppointment } from "@/lib/admin/appointments/service";
import { findRegisteredMonth } from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);

describe("admin appointments service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects booking when month is not registered", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce(null);

    await expect(
      createAdminAppointment(
        {
          month: "2026-03",
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_NOT_REGISTERED");
  });

  it("rejects booking when month is inactive", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-03",
      status: "INACTIVE",
      slotMode: "BLOCK_MODE",
    });

    await expect(
      createAdminAppointment(
        {
          month: "2026-03",
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_NOT_ACTIVE");
  });
});
