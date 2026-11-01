import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvailabilityEditorModal } from "@/components/admin/months/availability/AvailabilityEditorModal";
import { useAvailabilityEditor } from "@/hooks/admin/months/useAvailabilityEditor";
import { useAvailabilitySave } from "@/hooks/admin/months/useAvailabilitySave";
import { fetchAdminMonthAvailability } from "@/lib/admin/months/api-client";
import type { MonthAvailabilityResponse } from "@/lib/admin/months/types";

vi.mock("sileo", () => ({ sileo: { promise: vi.fn((promise: Promise<unknown>) => promise), error: vi.fn() } }));

vi.mock("@/lib/admin/months/api-client", () => ({
  fetchAdminMonthAvailability: vi.fn(),
  previewAdminMonthAvailability: vi.fn(),
  saveAdminMonthAvailability: vi.fn(),
}));

const fetchMock = vi.mocked(fetchAdminMonthAvailability);

// Smoke de render (T046): monta el modal con los hooks reales. Las pruebas de comportamiento completo son T054.
function Harness() {
  const editor = useAvailabilityEditor("2026-12");
  const save = useAvailabilitySave({
    month: "2026-12",
    payload: editor.payload,
    expectedVersion: editor.availabilityVersion,
    onClose: editor.close,
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

describe("AvailabilityEditorModal (smoke)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      month: "2026-12",
      availabilityVersion: 3,
      rules: [],
      exceptions: [],
      usesDefaultRule: true,
    } satisfies MonthAvailabilityResponse);
  });

  it("renders the loaded draft, keeps save disabled until a change, and asks before discarding", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "abrir editor" }));

    expect(await screen.findByText("Reglas semanales")).toBeInTheDocument();
    expect(screen.getByText(/Este mes no tiene reglas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar disponibilidad" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Agregar regla" }));

    expect(screen.getByText("Días de la semana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lun" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Agregar excepción" }));

    expect(screen.getByText("Sin horas: este día quedará cerrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar disponibilidad" })).toBeEnabled();

    // BottomSheetModal renderiza el overlay y la X con el mismo aria-label; cualquiera llama a onClose.
    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar editor de disponibilidad" })[0]);

    expect(await screen.findByText("¿Descartar cambios?")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Disponibilidad del mes" })).toBeInTheDocument();
  });
});
