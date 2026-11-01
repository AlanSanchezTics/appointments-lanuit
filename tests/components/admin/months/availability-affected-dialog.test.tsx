import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvailabilityEditorModal } from "@/components/admin/months/availability/AvailabilityEditorModal";
import { useMonthAvailabilityController } from "@/hooks/admin/months/useMonthAvailabilityController";
import {
  fetchAdminMonthAvailability,
  previewAdminMonthAvailability,
  saveAdminMonthAvailability,
} from "@/lib/admin/months/api-client";
import type { MonthAvailabilityResponse } from "@/lib/admin/months/types";

vi.mock("sileo", () => ({
  sileo: { show: vi.fn(() => "loading-toast"), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/admin/months/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/months/api-client")>()),
  fetchAdminMonthAvailability: vi.fn(),
  previewAdminMonthAvailability: vi.fn(),
  saveAdminMonthAvailability: vi.fn(),
}));

const fetchMock = vi.mocked(fetchAdminMonthAvailability);
const previewMock = vi.mocked(previewAdminMonthAvailability);
const saveMock = vi.mocked(saveAdminMonthAvailability);

const DIALOG_NAME = "Hay citas que quedarían fuera del horario";

const affectedItems = [
  {
    appointmentId: 7,
    date: "2026-12-05",
    timeSlot: "10:00",
    status: "CONFIRMED",
    clientName: "Ana García",
  },
];

const loadedMonth: MonthAvailabilityResponse = {
  month: "2026-12",
  availabilityVersion: 3,
  rules: [],
  exceptions: [],
  usesDefaultRule: true,
};

function Harness() {
  const { editor, save } = useMonthAvailabilityController({
    month: "2026-12",
    onSaved: async () => undefined,
  });

  return (
    <>
      <button type="button" onClick={() => void editor.open()}>
        abrir editor
      </button>
      <AvailabilityEditorModal month="2026-12" editor={editor} save={save} />
    </>
  );
}

// Abre el editor, añade una excepción (día cerrado) y pulsa Guardar: el preview trae citas afectadas.
async function requestSaveWithAffectedAppointments() {
  fireEvent.click(screen.getByRole("button", { name: "abrir editor" }));
  await screen.findByText("Reglas semanales");
  fireEvent.click(screen.getByRole("button", { name: "Agregar excepción" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar disponibilidad" }));

  return screen.findByRole("dialog", { name: DIALOG_NAME });
}

describe("AvailabilityAffectedAppointmentsDialog (T054)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    previewMock.mockReset();
    saveMock.mockReset();
    fetchMock.mockResolvedValue(loadedMonth);
    previewMock.mockResolvedValue({ affectedCount: 1, affectedAppointments: affectedItems });
    saveMock.mockResolvedValue(loadedMonth);
  });

  it("lists date, time, status and client of the affected appointments without writing", async () => {
    render(<Harness />);

    const dialog = await requestSaveWithAffectedAppointments();

    expect(within(dialog).getByText("Ana García")).toBeInTheDocument();
    expect(within(dialog).getByText("10:00", { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText("Confirmada")).toBeInTheDocument();
    expect(within(dialog).getByText("Sáb", { exact: false })).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("cancel closes the dialog and does not write", async () => {
    render(<Harness />);

    const dialog = await requestSaveWithAffectedAppointments();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: DIALOG_NAME })).not.toBeInTheDocument(),
    );
    expect(saveMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Disponibilidad del mes" })).toBeInTheDocument();
  });

  it("confirm resends the save with confirmAffectedAppointments true and the expected version", async () => {
    render(<Harness />);

    const dialog = await requestSaveWithAffectedAppointments();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar y guardar" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(
      "2026-12",
      expect.objectContaining({ expectedVersion: 3, confirmAffectedAppointments: true }),
    );
  });
});
