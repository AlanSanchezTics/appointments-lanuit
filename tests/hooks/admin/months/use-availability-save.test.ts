import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAvailabilitySave } from "@/hooks/admin/months/useAvailabilitySave";
import {
  AdminMonthApiError,
  previewAdminMonthAvailability,
  saveAdminMonthAvailability,
} from "@/lib/admin/months/api-client";
import type { PreviewAvailabilityPayload } from "@/lib/admin/months/types";

const sileoMock = vi.hoisted(() => ({
  show: vi.fn(() => "loading-toast"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sileo", () => ({ sileo: sileoMock }));

vi.mock("@/lib/admin/months/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/months/api-client")>();
  return {
    ...actual,
    previewAdminMonthAvailability: vi.fn(),
    saveAdminMonthAvailability: vi.fn(),
  };
});

const previewMock = vi.mocked(previewAdminMonthAvailability);
const saveMock = vi.mocked(saveAdminMonthAvailability);

const payload: PreviewAvailabilityPayload = { rules: [], exceptions: [] };
const affected = [
  { appointmentId: 87, date: "2026-12-03", timeSlot: "17:00", status: "CONFIRMED", clientName: "Ana" },
];
const savedResponse = {
  month: "2026-12",
  availabilityVersion: 4,
  rules: [],
  exceptions: [],
  usesDefaultRule: true,
};

function renderSave(
  overrides: Partial<{ expectedVersion: number | null; onSaved: () => Promise<void> }> = {},
) {
  const onClose = vi.fn();
  const onSaved = overrides.onSaved ?? vi.fn();
  const hook = renderHook(() =>
    useAvailabilitySave({
      month: "2026-12",
      payload,
      expectedVersion: overrides.expectedVersion === undefined ? 3 : overrides.expectedVersion,
      onClose,
      onSaved,
    }),
  );
  return { ...hook, onClose, onSaved };
}

describe("useAvailabilitySave", () => {
  beforeEach(() => {
    previewMock.mockReset();
    saveMock.mockReset();
    sileoMock.show.mockClear();
    sileoMock.dismiss.mockClear();
    sileoMock.success.mockClear();
    sileoMock.error.mockClear();
  });

  it("saves directly with expectedVersion when the preview has no affected appointments", async () => {
    previewMock.mockResolvedValue({ affectedCount: 0, affectedAppointments: [] });
    saveMock.mockResolvedValue(savedResponse);
    const { result, onClose, onSaved } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });

    expect(saveMock).toHaveBeenCalledWith("2026-12", {
      ...payload,
      expectedVersion: 3,
      confirmAffectedAppointments: false,
    });
    expect(sileoMock.success).toHaveBeenCalledTimes(1);
    expect(sileoMock.error).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(savedResponse);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it("opens the confirmation with affected appointments and does not write until confirmed", async () => {
    previewMock.mockResolvedValue({ affectedCount: 1, affectedAppointments: affected });
    saveMock.mockResolvedValue(savedResponse);
    const { result, onClose } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });

    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(true);
    expect(result.current.affectedAppointments).toEqual(affected);

    await act(async () => {
      await result.current.confirmSave();
    });

    expect(saveMock).toHaveBeenCalledWith("2026-12", expect.objectContaining({
      expectedVersion: 3,
      confirmAffectedAppointments: true,
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it("cancelling the confirmation keeps the editor open and writes nothing", async () => {
    previewMock.mockResolvedValue({ affectedCount: 1, affectedAppointments: affected });
    const { result, onClose } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });
    act(() => result.current.cancelConfirm());

    expect(saveMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(false);
    expect(result.current.affectedAppointments).toEqual([]);
  });

  it("does nothing while the version is not loaded", async () => {
    const { result } = renderSave({ expectedVersion: null });

    await act(async () => {
      await result.current.requestSave();
    });

    expect(previewMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("shows an error notification when the preview fails", async () => {
    previewMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const { result, onClose } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });

    expect(saveMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(sileoMock.error).toHaveBeenCalledWith({
      title: "No se pudo guardar la disponibilidad",
      description: "El mes no está registrado.",
    });
  });

  it("opens the confirmation when the server reports affected appointments after the preview", async () => {
    previewMock.mockResolvedValue({ affectedCount: 0, affectedAppointments: [] });
    saveMock.mockRejectedValueOnce(
      new AdminMonthApiError("AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED", affected),
    );
    const { result, onClose } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });

    expect(result.current.isConfirmOpen).toBe(true);
    expect(result.current.affectedAppointments).toEqual(affected);
    expect(sileoMock.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.isBusy).toBe(false);
  });

  it("maps a version conflict to the reload message in the sileo error notification", async () => {
    previewMock.mockResolvedValue({ affectedCount: 0, affectedAppointments: [] });
    saveMock.mockRejectedValueOnce(new AdminMonthApiError("AVAILABILITY_VERSION_CONFLICT"));
    const { result, onClose } = renderSave();

    await act(async () => {
      await result.current.requestSave();
    });

    expect(sileoMock.error).toHaveBeenCalledTimes(1);
    expect(sileoMock.error.mock.calls[0][0].description).toContain("Cierra el editor");
    expect(sileoMock.dismiss).toHaveBeenCalledWith("loading-toast");
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(false);
    expect(result.current.isBusy).toBe(false);
  });

  it("keeps busy until the close completes, so a second save cannot reuse the superseded version", async () => {
    previewMock.mockResolvedValue({ affectedCount: 0, affectedAppointments: [] });
    saveMock.mockResolvedValue(savedResponse);
    let finishReload!: () => void;
    const onSaved = vi.fn(() => new Promise<void>((resolve) => { finishReload = resolve; }));
    const { result, onClose } = renderSave({ onSaved });

    await act(async () => {
      void result.current.requestSave();
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.isBusy).toBe(true);

    await act(async () => {
      await result.current.requestSave();
    });
    await act(async () => {
      await result.current.confirmSave();
    });

    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finishReload();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.isBusy).toBe(false);
  });
});
