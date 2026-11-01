import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRescheduleTimeSlots } from "@/hooks/admin/months/useRescheduleTimeSlots";
import { fetchDayAgendaSlots } from "@/hooks/admin/months/fetch-day-agenda-slots";

vi.mock("@/hooks/admin/months/fetch-day-agenda-slots", () => ({
  fetchDayAgendaSlots: vi.fn(),
}));

const fetchMock = vi.mocked(fetchDayAgendaSlots);

type Props = Parameters<typeof useRescheduleTimeSlots>[0];

const editing: Props = {
  month: "2026-12",
  editDate: "2026-12-03",
  isEditing: true,
  excludeAppointmentId: 87,
  currentTimeSlot: "10:00",
  reloadKey: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useRescheduleTimeSlots", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("preselects the appointment's current time when the server still offers it", async () => {
    fetchMock.mockResolvedValue(["09:00", "10:00", "14:00"]);

    const { result } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });

    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "10:00", "14:00"]));
    expect(result.current.editTimeSlot).toBe("10:00");
    expect(fetchMock).toHaveBeenCalledWith("2026-12", "2026-12-03", expect.any(AbortSignal), 87);
  });

  it("falls back to the first offered time when the current time is no longer offered", async () => {
    fetchMock.mockResolvedValue(["09:00", "14:00"]);

    const { result } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });

    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "14:00"]));
    expect(result.current.editTimeSlot).toBe("09:00");
  });

  it("keeps the selection empty while loading and when the server offers no times", async () => {
    fetchMock.mockResolvedValue([]);

    const { result } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });

    expect(result.current.editTimeSlot).toBe("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.availableEditSlots).toEqual([]));
    expect(result.current.editTimeSlot).toBe("");
  });

  it("keeps the user's explicit choice after an agenda reload when the server still offers it", async () => {
    const offered = ["09:00", "10:00", "14:00"];
    fetchMock.mockResolvedValueOnce(offered).mockResolvedValueOnce(offered);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));

    act(() => result.current.setEditTimeSlot("14:00"));
    rerender({ ...editing, reloadKey: 2 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.editTimeSlot).toBe("14:00"));
  });

  it("returns to the current time when the chosen time is no longer offered after a reload, and does not restore it later", async () => {
    fetchMock
      .mockResolvedValueOnce(["09:00", "10:00", "14:00"])
      .mockResolvedValueOnce(["09:00", "10:00"])
      .mockResolvedValueOnce(["09:00", "10:00", "14:00"]);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));

    act(() => result.current.setEditTimeSlot("14:00"));
    rerender({ ...editing, reloadKey: 2 });
    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "10:00"]));
    expect(result.current.editTimeSlot).toBe("10:00");

    rerender({ ...editing, reloadKey: 3 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "10:00", "14:00"]));
    expect(result.current.editTimeSlot).toBe("10:00");
  });

  it("discards the user's choice when switching to another appointment", async () => {
    fetchMock
      .mockResolvedValueOnce(["09:00", "10:00", "14:00"])
      .mockResolvedValueOnce(["09:00", "10:00", "14:00"]);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));

    act(() => result.current.setEditTimeSlot("14:00"));
    rerender({ ...editing, excludeAppointmentId: 88, currentTimeSlot: "09:00" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.editTimeSlot).toBe("09:00"));
  });

  it("discards the user's choice when the edit is closed and reopened", async () => {
    fetchMock.mockResolvedValue(["09:00", "10:00", "14:00"]);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));

    act(() => result.current.setEditTimeSlot("14:00"));
    rerender({ ...editing, isEditing: false });
    rerender({ ...editing, isEditing: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));
  });

  it("empties the list and the selection while a new day loads, then restores the explicit choice if the new day offers it", async () => {
    const newDay = deferred<string[]>();
    fetchMock.mockImplementation((_month: string, date: string) =>
      date === "2026-12-04" ? newDay.promise : Promise.resolve(["09:00", "10:00", "14:00"]),
    );

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));
    act(() => result.current.setEditTimeSlot("14:00"));

    rerender({ ...editing, editDate: "2026-12-04" });

    expect(result.current.editTimeSlot).toBe("");
    expect(result.current.availableEditSlots).toEqual([]);

    await act(async () => newDay.resolve(["09:00", "10:00", "14:00"]));

    await waitFor(() => expect(result.current.editTimeSlot).toBe("14:00"));
    expect(result.current.availableEditSlots).toEqual(["09:00", "10:00", "14:00"]);
  });

  it("falls back to the current time on a new day that does not offer the choice, and restores the choice when returning to a day that offers it", async () => {
    fetchMock.mockImplementation((_month: string, date: string) =>
      Promise.resolve(date === "2026-12-04" ? ["09:00", "10:00"] : ["09:00", "10:00", "14:00"]),
    );

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));
    act(() => result.current.setEditTimeSlot("14:00"));

    rerender({ ...editing, editDate: "2026-12-04" });
    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "10:00"]));
    expect(result.current.editTimeSlot).toBe("10:00");

    rerender({ ...editing, editDate: "2026-12-03" });
    await waitFor(() => expect(result.current.availableEditSlots).toEqual(["09:00", "10:00", "14:00"]));
    expect(result.current.editTimeSlot).toBe("14:00");
  });

  it("keeps the list and the selection during a reload of the same date", async () => {
    const reload = deferred<string[]>();
    fetchMock.mockResolvedValueOnce(["09:00", "10:00", "14:00"]).mockReturnValueOnce(reload.promise);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));
    act(() => result.current.setEditTimeSlot("14:00"));

    rerender({ ...editing, reloadKey: 2 });

    expect(result.current.editTimeSlot).toBe("14:00");
    expect(result.current.availableEditSlots).toEqual(["09:00", "10:00", "14:00"]);

    await act(async () => reload.resolve(["09:00", "10:00", "14:00"]));
    expect(result.current.editTimeSlot).toBe("14:00");
  });

  it("clears the selection when editing stops", async () => {
    fetchMock.mockResolvedValue(["09:00", "10:00"]);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.editTimeSlot).toBe("10:00"));

    rerender({ ...editing, isEditing: false });

    expect(result.current.editTimeSlot).toBe("");
    expect(result.current.availableEditSlots).toEqual([]);
  });

  it("reports loading while the first list is pending and clears it once loaded", async () => {
    const first = deferred<string[]>();
    fetchMock.mockReturnValueOnce(first.promise);

    const { result } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });

    expect(result.current.isLoadingSlots).toBe(true);
    await act(async () => first.resolve(["09:00", "10:00"]));
    expect(result.current.isLoadingSlots).toBe(false);
    expect(result.current.editTimeSlot).toBe("10:00");
  });

  it("reports loading during a day change but not during a reload of the same date", async () => {
    const newDay = deferred<string[]>();
    const reload = deferred<string[]>();
    fetchMock
      .mockResolvedValueOnce(["09:00", "10:00", "14:00"])
      .mockReturnValueOnce(newDay.promise)
      .mockReturnValueOnce(reload.promise);

    const { result, rerender } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });
    await waitFor(() => expect(result.current.isLoadingSlots).toBe(false));

    rerender({ ...editing, editDate: "2026-12-04" });
    expect(result.current.isLoadingSlots).toBe(true);
    await act(async () => newDay.resolve(["09:00", "10:00"]));
    expect(result.current.isLoadingSlots).toBe(false);

    rerender({ ...editing, editDate: "2026-12-04", reloadKey: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.isLoadingSlots).toBe(false);
    await act(async () => reload.resolve(["09:00", "10:00"]));
  });

  it("clears loading when the day's times fail to load", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook((props: Props) => useRescheduleTimeSlots(props), {
      initialProps: editing,
    });

    await waitFor(() => expect(result.current.isLoadingSlots).toBe(false));
    expect(result.current.availableEditSlots).toEqual([]);
    expect(result.current.editTimeSlot).toBe("");
  });
});
