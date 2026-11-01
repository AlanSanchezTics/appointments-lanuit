import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function loadedMonth(overrides: Partial<MonthAvailabilityResponse> = {}): MonthAvailabilityResponse {
  return {
    month: "2026-12",
    availabilityVersion: 3,
    rules: [],
    exceptions: [],
    usesDefaultRule: true,
    ...overrides,
  };
}

function Harness({ onSaved }: { onSaved?: () => Promise<void> }) {
  const { editor, save } = useMonthAvailabilityController({
    month: "2026-12",
    onSaved: onSaved ?? (async () => undefined),
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

async function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "abrir editor" }));
  await screen.findByText("Reglas semanales");
}

describe("AvailabilityEditorModal (T054)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    previewMock.mockReset();
    saveMock.mockReset();
    previewMock.mockResolvedValue({ affectedCount: 0, affectedAppointments: [] });
    saveMock.mockResolvedValue(loadedMonth());
  });

  it("renders loaded rules and exceptions, and an exception without times as a closed day", async () => {
    fetchMock.mockResolvedValue(
      loadedMonth({
        usesDefaultRule: false,
        rules: [
          {
            id: 1,
            startDate: "2026-12-01",
            endDate: "2026-12-31",
            weekdays: [1, 2, 3, 4, 5],
            times: ["09:00", "10:00"],
            minGapMinutes: 0,
            preserveCapacity: false,
            maxPerDay: 2,
          },
        ],
        exceptions: [
          {
            id: 2,
            date: "2026-12-24",
            times: [],
            minGapMinutes: 240,
            preserveCapacity: true,
            maxPerDay: 3,
          },
        ],
      }),
    );

    render(<Harness />);
    await openEditor();

    expect(screen.getByRole("button", { name: "Lun" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Sin horas: este día quedará cerrado.")).toBeInTheDocument();
    expect(screen.queryByText(/Este mes no tiene reglas/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar disponibilidad" })).toBeDisabled();
  });

  it("mirrors rule validation: a rule without weekdays shows the error and blocks saving", async () => {
    fetchMock.mockResolvedValue(loadedMonth());

    render(<Harness />);
    await openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Agregar regla" }));
    for (const day of ["Lun", "Mar", "Mié", "Jue", "Vie"]) {
      fireEvent.click(screen.getByRole("button", { name: day }));
    }

    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona al menos un día de la semana.");
    expect(screen.getByRole("button", { name: "Guardar disponibilidad" })).toBeDisabled();
  });

  it("an empty hour list on a new exception closes that day and keeps saving enabled", async () => {
    fetchMock.mockResolvedValue(loadedMonth());

    render(<Harness />);
    await openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Agregar excepción" }));

    expect(screen.getByText("Sin horas: este día quedará cerrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar disponibilidad" })).toBeEnabled();
  });

  it("saves without affected appointments with the expected version and no confirmation", async () => {
    fetchMock.mockResolvedValue(loadedMonth());

    render(<Harness />);
    await openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Agregar excepción" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar disponibilidad" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(
      "2026-12",
      expect.objectContaining({
        expectedVersion: 3,
        confirmAffectedAppointments: false,
        exceptions: [expect.objectContaining({ date: "2026-12-01", times: [] })],
      }),
    );
    expect(previewMock).toHaveBeenCalledWith("2026-12", expect.not.objectContaining({ expectedVersion: 3 }));
  });
});
