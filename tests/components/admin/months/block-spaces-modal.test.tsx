import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlockSpacesModal } from "@/components/admin/months/BlockSpacesModal";

describe("BlockSpacesModal", () => {
  it("triggers select all when toggle is unchecked", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();
    const onToggleSlot = vi.fn();
    const onToggleBlockSlots = vi.fn();
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
    const onSlotViewModeChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00"]}
        selectedSlots={["09:00"]}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        slotViewMode="hour"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onToggleBlockSlots={onToggleBlockSlots}
        onSelectAllSlots={onSelectAllSlots}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
        onSlotViewModeChange={onSlotViewModeChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Seleccionar todo/i }));

    expect(onSelectAllSlots).toHaveBeenCalledTimes(1);
    expect(onClearSelectedSlots).not.toHaveBeenCalled();
  });

  it("triggers clear selection when toggle is checked", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();
    const onToggleSlot = vi.fn();
    const onToggleBlockSlots = vi.fn();
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
    const onSlotViewModeChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00"]}
        selectedSlots={["09:00", "10:00", "13:00"]}
        areAllSelectedForDay
        reason="DESCANSO"
        slotViewMode="hour"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onToggleBlockSlots={onToggleBlockSlots}
        onSelectAllSlots={onSelectAllSlots}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
        onSlotViewModeChange={onSlotViewModeChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Seleccionar todo/i }));

    expect(onSelectAllSlots).not.toHaveBeenCalled();
    expect(onClearSelectedSlots).toHaveBeenCalledTimes(1);
  });

  it("changes slot view mode from hour to block", () => {
    const onSlotViewModeChange = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00", "14:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00", "14:00"]}
        selectedSlots={[]}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        slotViewMode="hour"
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSelectDate={vi.fn()}
        onToggleSlot={vi.fn()}
        onToggleBlockSlots={vi.fn()}
        onSelectAllSlots={vi.fn()}
        onClearSelectedSlots={vi.fn()}
        onReasonChange={vi.fn()}
        onSlotViewModeChange={onSlotViewModeChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Por bloque/i }));

    expect(onSlotViewModeChange).toHaveBeenCalledWith("block");
  });

  it("toggles all slots in a selected block when block view card is pressed", () => {
    const onToggleBlockSlots = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00"]}
        selectedSlots={[]}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        slotViewMode="block"
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSelectDate={vi.fn()}
        onToggleSlot={vi.fn()}
        onToggleBlockSlots={onToggleBlockSlots}
        onSelectAllSlots={vi.fn()}
        onClearSelectedSlots={vi.fn()}
        onReasonChange={vi.fn()}
        onSlotViewModeChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /09:00 AM - 10:00 AM/i }));

    expect(onToggleBlockSlots).toHaveBeenCalledWith(["09:00", "10:00"]);
  });
});
