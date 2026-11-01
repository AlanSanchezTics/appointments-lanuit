import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAvailabilityEditor } from "@/hooks/admin/months/useAvailabilityEditor";
import { fetchAdminMonthAvailability } from "@/lib/admin/months/api-client";
import type { MonthAvailabilityResponse } from "@/lib/admin/months/types";

vi.mock("@/lib/admin/months/api-client", () => ({
  fetchAdminMonthAvailability: vi.fn(),
}));

const fetchMock = vi.mocked(fetchAdminMonthAvailability);

const loadedResponse: MonthAvailabilityResponse = {
  month: "2026-12",
  availabilityVersion: 3,
  slotMode: "BLOCK_MODE",
  rules: [
    {
      id: 11,
      startDate: "2026-12-01",
      endDate: "2026-12-13",
      weekdays: [1, 2, 3, 4, 5],
      times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
      minGapMinutes: 240,
      preserveCapacity: true,
      maxPerDay: 3,
    },
  ],
  exceptions: [
    { id: 4, date: "2026-12-19", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  ],
  usesDefaultRule: false,
};

async function renderLoadedEditor() {
  const hook = renderHook(() => useAvailabilityEditor("2026-12"));

  await act(async () => {
    await hook.result.current.open();
  });

  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("useAvailabilityEditor", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(loadedResponse);
  });

  it("loads rules and exceptions into the draft without marking it dirty", async () => {
    const { result } = await renderLoadedEditor();

    expect(result.current.isOpen).toBe(true);
    expect(result.current.availabilityVersion).toBe(3);
    expect(result.current.rules).toHaveLength(1);
    expect(result.current.exceptions).toHaveLength(1);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.usesDefaultRule).toBe(false);
    expect(result.current.payload).not.toHaveProperty("rules.0.id");
    expect(result.current.payload.rules[0]).not.toHaveProperty("key");
  });

  it("adds a rule with month bounds, Monday to Friday, D6 hours and marks the draft dirty", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.addRule());

    const added = result.current.rules[1];
    expect(result.current.isDirty).toBe(true);
    expect(added.startDate).toBe("2026-12-01");
    expect(added.endDate).toBe("2026-12-31");
    expect(added.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(added.minGapMinutes).toBe(240);
    expect(added.preserveCapacity).toBe(true);
    expect(added.maxPerDay).toBe(3);
    expect(added.times).toEqual(["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"]);
  });

  it("adds an exception with its own defaults and an empty time list (closed day, A2)", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.addException());

    const added = result.current.exceptions[1];
    expect(added.date).toBe("2026-12-01");
    expect(added.times).toEqual([]);
    expect(added.minGapMinutes).toBe(240);
    expect(added.preserveCapacity).toBe(true);
    expect(added.maxPerDay).toBe(3);
    expect(result.current.isValid).toBe(true);
  });

  it("flags 00:00 as invalid on the rule (D55) through the engine mirror", async () => {
    const { result } = await renderLoadedEditor();
    const ruleKey = result.current.rules[0].key;

    act(() => result.current.updateRule(ruleKey, { times: ["00:00", "09:00"] }));

    expect(result.current.ruleErrors[ruleKey]).toBe("AVAILABILITY_TIME_INVALID");
    expect(result.current.isValid).toBe(false);
  });

  it("flags out-of-month dates on a rule", async () => {
    const { result } = await renderLoadedEditor();
    const ruleKey = result.current.rules[0].key;

    act(() => result.current.updateRule(ruleKey, { endDate: "2027-01-02" }));

    expect(result.current.ruleErrors[ruleKey]).toBe("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
  });

  it("reports overlapping rules only at the set level", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.addRule());

    expect(Object.keys(result.current.ruleErrors)).toHaveLength(0);
    expect(result.current.configErrorCode).toBe("AVAILABILITY_RULE_OVERLAP");
    expect(result.current.isValid).toBe(false);
  });

  it("reports duplicate exception dates at the set level", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.addException());
    const secondKey = result.current.exceptions[1].key;
    act(() => result.current.updateException(secondKey, { date: "2026-12-19" }));

    expect(result.current.configErrorCode).toBe("AVAILABILITY_EXCEPTION_DATE_DUPLICATE");
  });

  it("treats an empty rule list as the D6 default", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.removeRule(result.current.rules[0].key));

    expect(result.current.usesDefaultRule).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  it("asks for confirmation before closing with unsaved changes and keeps editing on request", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.addRule());
    act(() => result.current.requestClose());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isDiscardConfirmOpen).toBe(true);

    act(() => result.current.keepEditing());

    expect(result.current.isDiscardConfirmOpen).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it("closes without confirmation when there are no unsaved changes", async () => {
    const { result } = await renderLoadedEditor();

    act(() => result.current.requestClose());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.rules).toHaveLength(0);
  });

  it("exposes a load error code when the availability request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const { result } = renderHook(() => useAvailabilityEditor("2026-12"));

    await act(async () => {
      await result.current.open();
    });

    expect(result.current.loadErrorCode).toBe("MONTH_NOT_REGISTERED");
    expect(result.current.isLoading).toBe(false);
  });
});
