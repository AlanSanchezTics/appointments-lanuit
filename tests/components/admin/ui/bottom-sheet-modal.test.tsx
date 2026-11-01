import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Tooltip } from "@/components/admin/ui/Tooltip";

function renderSheet(props: Partial<React.ComponentProps<typeof BottomSheetModal>> = {}) {
  const onClose = vi.fn();
  render(
    <BottomSheetModal isOpen title="Panel" closeLabel="Cerrar panel" onClose={onClose} {...props}>
      <p>contenido</p>
    </BottomSheetModal>,
  );
  return { onClose };
}

describe("BottomSheetModal", () => {
  it("renders children and nothing extra when no overlay is passed", () => {
    renderSheet();

    const panel = screen.getByRole("dialog", { name: "Panel" });
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(panel.querySelector('[role="alertdialog"]')).toBeNull();
    expect(panel.lastElementChild?.tagName).toBe("DIV");
    expect(panel.lastElementChild?.className).toContain("overflow-y-auto");
  });

  it("renders the overlay inside the panel but outside the scrollable area", () => {
    renderSheet({ overlay: <div role="alertdialog" aria-label="Aviso">superpuesto</div> });

    const panel = screen.getByRole("dialog", { name: "Panel" });
    const overlay = screen.getByRole("alertdialog", { name: "Aviso" });
    const scrollArea = panel.querySelector(".overflow-y-auto");

    expect(panel).toContainElement(overlay);
    expect(scrollArea).not.toContainElement(overlay);
    expect(panel.lastElementChild).toBe(overlay);
  });

  it("calls onClose on Escape unless disableClose is set", () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while disableClose is set", () => {
    const { onClose } = renderSheet({ disableClose: true });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets Escape close only an open tooltip inside the sheet, then closes the sheet", () => {
    const onClose = vi.fn();
    render(
      <BottomSheetModal isOpen title="Panel" closeLabel="Cerrar panel" onClose={onClose}>
        <Tooltip label="Ayuda de prueba">
          <span>Texto de ayuda</span>
        </Tooltip>
      </BottomSheetModal>,
    );
    const trigger = screen.getByRole("button", { name: "Ayuda de prueba" });

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("tooltip", { hidden: true })).not.toBeVisible();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
