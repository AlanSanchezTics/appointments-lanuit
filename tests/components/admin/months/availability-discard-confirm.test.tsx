import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// Abre el editor, lo ensucia y pide cerrar con la X del panel (overlay o X: mismo aria-label).
async function openDirtyAndRequestClose() {
  fireEvent.click(screen.getByRole("button", { name: "abrir editor" }));
  expect(await screen.findByText("Reglas semanales")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Agregar regla" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Cerrar editor de disponibilidad" })[0]);
  return screen.findByRole("alertdialog", { name: "¿Descartar cambios?" });
}

describe("AvailabilityEditorModal discard confirmation", () => {
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

  it("renders the confirmation as an alertdialog over the panel, outside the scrollable form", async () => {
    render(<Harness />);

    const alertDialog = await openDirtyAndRequestClose();
    const panel = screen.getByRole("dialog", { name: "Disponibilidad del mes" });
    const scrollArea = panel.querySelector(".overflow-y-auto");

    expect(panel).toContainElement(alertDialog);
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).not.toContainElement(alertDialog);
    expect(alertDialog).toHaveAttribute("aria-describedby");
    expect(screen.getAllByText("¿Descartar cambios?")).toHaveLength(1);
  });

  it("moves focus to 'Seguir editando' when opened and returns it to the previous control on Escape", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "abrir editor" }));
    expect(await screen.findByText("Reglas semanales")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar regla" }));

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    act(() => cancelButton.focus());
    fireEvent.click(cancelButton);

    const alertDialog = await screen.findByRole("alertdialog", { name: "¿Descartar cambios?" });
    const keepButton = within(alertDialog).getByRole("button", { name: "Seguir editando" });
    expect(keepButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Disponibilidad del mes" })).toBeInTheDocument();
    expect(cancelButton).toHaveFocus();
  });

  it("keeps the editor open with 'Seguir editando' and disables the form while the confirmation is open", async () => {
    const { container } = render(<Harness />);

    const alertDialog = await openDirtyAndRequestClose();
    expect(container.querySelector("[inert]")).not.toBeNull();

    fireEvent.click(within(alertDialog).getByRole("button", { name: "Seguir editando" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(container.querySelector("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Agregar regla" })).toBeEnabled();
  });

  it("shows a scrim behind the card only while confirming, and a click on it neither closes nor discards", async () => {
    render(<Harness />);

    const alertDialog = await openDirtyAndRequestClose();
    const panel = screen.getByRole("dialog", { name: "Disponibilidad del mes" });
    const scrim = panel.querySelector<HTMLElement>('[aria-hidden="true"].inset-0');

    expect(scrim).not.toBeNull();
    expect(scrim).not.toContainElement(alertDialog);
    expect(scrim).toHaveClass("z-10");
    expect(alertDialog).toHaveClass("z-20");

    fireEvent.click(scrim as HTMLElement);

    expect(screen.getByRole("alertdialog", { name: "¿Descartar cambios?" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Disponibilidad del mes" })).toBeInTheDocument();

    fireEvent.click(within(alertDialog).getByRole("button", { name: "Seguir editando" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(panel.querySelector('[aria-hidden="true"].inset-0')).toBeNull();
  });

  it("discards the draft and closes the editor with 'Descartar'", async () => {
    render(<Harness />);

    const alertDialog = await openDirtyAndRequestClose();
    fireEvent.click(within(alertDialog).getByRole("button", { name: "Descartar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Disponibilidad del mes" })).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
