import { describe, expect, it, vi } from "vitest";

import AdminMonthsPage from "@/app/admin/months/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "admin@example.com" } })),
}));

vi.mock("@/components/admin/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/admin/months/MonthsCatalogView", () => ({
  MonthsCatalogView: () => null,
}));

vi.mock("@/lib/admin/months/service", () => ({
  getMonthsCatalog: vi.fn(async () => ({
    filters: { year: 2026, status: "ALL", availableYears: [2026] },
    metrics: {
      activeMonths: 0,
      inactiveMonths: 0,
      futureMonths: 0,
      pastMonths: 0,
      pastAppointments: 0,
      futureAppointments: 0,
    },
    months: [],
    total: 0,
    currentMonth: "2026-10",
    currentDate: "2026-10-27",
  })),
}));

async function renderInitialShowPast(past: string | string[] | undefined) {
  const element = await AdminMonthsPage({
    searchParams: Promise.resolve({ year: "2026", status: "ALL", ...(past === undefined ? {} : { past }) }),
  });

  // La página devuelve <AdminLayout><MonthsCatalogView .../></AdminLayout>.
  return element.props.children.props.initialShowPast;
}

describe("AdminMonthsPage past param", () => {
  it("hides past months when the param is absent", async () => {
    expect(await renderInitialShowPast(undefined)).toBe(false);
  });

  it("shows past months only for past=1", async () => {
    expect(await renderInitialShowPast("1")).toBe(true);
  });

  it.each(["0", "true", "yes", ""])("hides past months for past=%s", async (value) => {
    expect(await renderInitialShowPast(value)).toBe(false);
  });

  it("hides past months when the param is repeated", async () => {
    expect(await renderInitialShowPast(["1", "1"])).toBe(false);
  });
});
