import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const createManyMock = vi.fn();
const availabilityRuleCreateManyMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      findMany: findManyMock,
    },
    activeMonth: {
      createMany: createManyMock,
    },
    availabilityRule: {
      createMany: availabilityRuleCreateManyMock,
    },
  },
}));

describe("listAppointmentsByMonth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
  });

  // D66: el detalle del mes cuenta CONFIRMED y SYNC_FAILED como ocupadas (PENDING no cuenta), más CANCELLED para la métrica.
  it("queries occupied statuses plus CANCELLED without PENDING (D66)", async () => {
    const { listAppointmentsByMonth } = await import("@/lib/db/admin-months");

    await listAppointmentsByMonth("2026-03-01", "2026-04-01");

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.status.in).toEqual(["CONFIRMED", "SYNC_FAILED", "CANCELLED"]);
    expect(where.status.in).not.toContain("PENDING");
    expect(where.status.in).not.toContain("REJECTED");
  });
});

describe("createInactiveMonths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createManyMock.mockResolvedValue({ count: 2 });
  });

  // D17/D31: un mes nuevo se crea INACTIVE con BLOCK_MODE y sin reglas (el default D6 se aplica al leer).
  it("creates inactive months with BLOCK_MODE and never writes availability rules (D17, D31)", async () => {
    const { createInactiveMonths } = await import("@/lib/db/admin-months");

    await createInactiveMonths(["2026-06", "2026-08"]);

    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        { month: "2026-06", status: "INACTIVE" },
        { month: "2026-08", status: "INACTIVE" },
      ],
      skipDuplicates: true,
    });
    expect(availabilityRuleCreateManyMock).not.toHaveBeenCalled();
  });

  it("does nothing when there are no months to create", async () => {
    const { createInactiveMonths } = await import("@/lib/db/admin-months");

    await createInactiveMonths([]);

    expect(createManyMock).not.toHaveBeenCalled();
  });
});
