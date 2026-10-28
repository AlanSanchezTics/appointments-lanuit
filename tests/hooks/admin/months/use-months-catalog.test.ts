import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMonthsCatalog } from "@/hooks/admin/months/useMonthsCatalog";
import { fetchMonthsCatalog } from "@/lib/admin/months/api-client";
import type { MonthsCatalogResponse } from "@/lib/admin/months/types";

const transitionState = vi.hoisted(() => ({
  // null: useTransition real. true/false: simula una navegación pendiente o confirmada.
  forcedPending: null as boolean | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () => {
      const [isPending, startTransition] = actual.useTransition();
      return [transitionState.forcedPending ?? isPending, startTransition] as const;
    },
  };
});

const routerReplaceMock = vi.fn();
let currentQuery = "year=2026&status=ALL";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/months",
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

vi.mock("@/lib/admin/months/api-client", () => ({
  // Pendiente a propósito salvo donde un test lo resuelva explícitamente.
  fetchMonthsCatalog: vi.fn(() => new Promise(() => {})),
}));

// currentMonth = 2026-10: dos meses pasados, el actual y uno futuro.
const initialData: MonthsCatalogResponse = {
  filters: { year: 2026, status: "ALL", availableYears: [2026, 2027] },
  metrics: {
    activeMonths: 2,
    inactiveMonths: 2,
    futureMonths: 1,
    pastMonths: 2,
    pastAppointments: 0,
    futureAppointments: 0,
  },
  months: [
    { month: "2026-08", status: "ACTIVE" },
    { month: "2026-09", status: "ACTIVE" },
    { month: "2026-10", status: "ACTIVE" },
    { month: "2026-11", status: "INACTIVE" },
  ],
  total: 4,
  currentMonth: "2026-10",
  currentDate: "2026-10-27",
};

const onlyPastData: MonthsCatalogResponse = {
  ...initialData,
  months: [
    { month: "2026-08", status: "ACTIVE" },
    { month: "2026-09", status: "ACTIVE" },
  ],
  total: 2,
};

const data2027: MonthsCatalogResponse = {
  ...initialData,
  filters: { year: 2027, status: "ALL", availableYears: [2026, 2027] },
};

function visibleMonthKeys(result: { current: ReturnType<typeof useMonthsCatalog> }) {
  return result.current.visibleMonths.map((item) => item.month);
}

describe("useMonthsCatalog past months filter", () => {
  beforeEach(() => {
    routerReplaceMock.mockClear();
    vi.mocked(fetchMonthsCatalog).mockClear();
    currentQuery = "year=2026&status=ALL";
    transitionState.forcedPending = null;
  });

  it("hides past months by default and reports that some were hidden", () => {
    const { result } = renderHook(() => useMonthsCatalog({ initialData }));

    expect(result.current.showPast).toBe(false);
    expect(visibleMonthKeys(result)).toEqual(["2026-10", "2026-11"]);
    expect(result.current.hasHiddenPastMonths).toBe(true);
  });

  it("shows past months when the initial value comes from ?past=1", () => {
    const { result } = renderHook(() =>
      useMonthsCatalog({ initialData, initialShowPast: true }),
    );

    expect(result.current.showPast).toBe(true);
    expect(visibleMonthKeys(result)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(result.current.hasHiddenPastMonths).toBe(false);
  });

  it("toggling on adds past=1 with router.replace and keeps year and status", () => {
    currentQuery = "year=2026&status=ACTIVE";
    const { result } = renderHook(() => useMonthsCatalog({ initialData }));

    act(() => result.current.updateShowPast(true));

    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/admin/months?year=2026&status=ACTIVE&past=1",
      { scroll: false },
    );
    expect(result.current.showPast).toBe(true);
    expect(visibleMonthKeys(result)).toHaveLength(4);
  });

  it("toggling off removes past without losing year and status", () => {
    currentQuery = "year=2026&status=ALL&past=1";
    const { result } = renderHook(() =>
      useMonthsCatalog({ initialData, initialShowPast: true }),
    );

    act(() => result.current.updateShowPast(false));

    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/admin/months?year=2026&status=ALL",
      { scroll: false },
    );
    expect(visibleMonthKeys(result)).toEqual(["2026-10", "2026-11"]);
  });

  it("keeps past=1 in the URL when the status changes", () => {
    currentQuery = "year=2026&status=ALL&past=1";
    const { result } = renderHook(() =>
      useMonthsCatalog({ initialData, initialShowPast: true }),
    );

    act(() => result.current.updateStatus("INACTIVE"));

    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2026&status=INACTIVE&past=1",
      { scroll: false },
    );
  });

  it("keeps past=1 in the URL when the selected year changes", () => {
    currentQuery = "year=2026&status=ALL&past=1";
    const { result } = renderHook(() =>
      useMonthsCatalog({ initialData, initialShowPast: true }),
    );

    act(() => result.current.updateYear(2027));

    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2027&status=ALL&past=1",
      { scroll: false },
    );
  });

  it("reports hidden past months when every visible month is past", () => {
    const { result } = renderHook(() => useMonthsCatalog({ initialData: onlyPastData }));

    expect(result.current.visibleMonths).toHaveLength(0);
    expect(result.current.hasHiddenPastMonths).toBe(true);
  });

  it("does not report hidden past months when the list has no past months", () => {
    const futureOnly: MonthsCatalogResponse = {
      ...initialData,
      months: [{ month: "2026-11", status: "INACTIVE" }],
    };
    const { result } = renderHook(() => useMonthsCatalog({ initialData: futureOnly }));

    expect(result.current.visibleMonths).toHaveLength(1);
    expect(result.current.hasHiddenPastMonths).toBe(false);
  });

  it("does not fetch the catalog when the switch changes", () => {
    const { result } = renderHook(() => useMonthsCatalog({ initialData }));

    act(() => result.current.updateShowPast(true));
    act(() => result.current.updateShowPast(false));

    expect(fetchMonthsCatalog).not.toHaveBeenCalled();
    expect(routerReplaceMock).toHaveBeenCalledTimes(2);
  });

  it("syncs the switch state when the initialShowPast prop changes", () => {
    const { result, rerender } = renderHook(
      ({ initialShowPast }) => useMonthsCatalog({ initialData, initialShowPast }),
      { initialProps: { initialShowPast: false } },
    );

    expect(result.current.showPast).toBe(false);

    rerender({ initialShowPast: true });
    expect(result.current.showPast).toBe(true);
    expect(result.current.visibleMonths).toHaveLength(4);

    rerender({ initialShowPast: false });
    expect(result.current.showPast).toBe(false);
  });
});

describe("useMonthsCatalog writes from the confirmed URL", () => {
  beforeEach(() => {
    routerReplaceMock.mockClear();
    vi.mocked(fetchMonthsCatalog).mockClear();
    currentQuery = "year=2026&status=ALL";
    transitionState.forcedPending = null;
  });

  it("every write starts from the current URL and keeps unrelated params", () => {
    currentQuery = "year=2026&status=ALL&foo=bar";
    const { result, rerender } = renderHook(() => useMonthsCatalog({ initialData }));

    act(() => result.current.updateShowPast(true));
    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2026&status=ALL&foo=bar&past=1",
      { scroll: false },
    );

    // La navegación se confirma: la siguiente escritura parte de la nueva URL.
    currentQuery = "year=2026&status=ALL&foo=bar&past=1";
    rerender();
    act(() => result.current.updateStatus("ACTIVE"));
    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2026&status=ACTIVE&foo=bar&past=1",
      { scroll: false },
    );
  });

  it("isBusy includes a pending navigation", () => {
    const { result, rerender } = renderHook(() => useMonthsCatalog({ initialData }));

    expect(result.current.isBusy).toBe(false);

    transitionState.forcedPending = true;
    rerender();
    expect(result.current.isPending).toBe(true);
    expect(result.current.isBusy).toBe(true);

    transitionState.forcedPending = false;
    rerender();
    expect(result.current.isBusy).toBe(false);
  });

  it("switch written after a year change uses the confirmed URL (B1 with controls disabled)", async () => {
    vi.mocked(fetchMonthsCatalog).mockResolvedValueOnce(data2027);
    const { result, rerender } = renderHook(() => useMonthsCatalog({ initialData }));

    // La navegación de año queda pendiente: la vista deshabilita los controles.
    transitionState.forcedPending = true;
    await act(async () => {
      result.current.updateYear(2027);
    });
    rerender();
    expect(result.current.isBusy).toBe(true);

    // La navegación se confirma y el fetch termina.
    currentQuery = "year=2027&status=ALL";
    transitionState.forcedPending = null;
    rerender();
    expect(result.current.isBusy).toBe(false);

    act(() => result.current.updateShowPast(true));
    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2027&status=ALL&past=1",
      { scroll: false },
    );
  });

  it("a write that never reached the URL does not leak into a later external navigation", () => {
    currentQuery = "year=2027&status=ALL";
    const { result, rerender } = renderHook(() => useMonthsCatalog({ initialData }));

    // El cambio de año queda sin confirmar; llega una navegación externa.
    act(() => result.current.updateYear(2026));
    currentQuery = "year=2027&status=ACTIVE";
    rerender();
    act(() => result.current.updateStatus("INACTIVE"));

    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?year=2027&status=INACTIVE",
      { scroll: false },
    );
  });

  it("toggle back and forth followed by an external navigation writes only the new status", () => {
    currentQuery = "year=2027&status=ALL";
    const { result, rerender } = renderHook(() => useMonthsCatalog({ initialData }));

    act(() => result.current.updateShowPast(true));
    act(() => result.current.updateShowPast(false));

    // Navegación externa a /admin/months sin params.
    currentQuery = "";
    rerender();
    act(() => result.current.updateStatus("INACTIVE"));

    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      "/admin/months?status=INACTIVE",
      { scroll: false },
    );
  });
});
