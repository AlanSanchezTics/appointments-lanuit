import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlockSpacesModal } from "@/components/admin/months/BlockSpacesModal";

describe("BlockSpacesModal", () => {
  it("triggers select all when toggle is unchecked", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();
    const onToggleSlot = vi.fn();
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
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
        isFullDaySelected={false}
        canSelectFullDay={true}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onSelectAllSlots={onSelectAllSlots}
        onSelectFullDay={vi.fn()}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
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
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
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
        isFullDaySelected={false}
        canSelectFullDay={true}
        areAllSelectedForDay
        reason="DESCANSO"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onSelectAllSlots={onSelectAllSlots}
        onSelectFullDay={vi.fn()}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Seleccionar todo/i }));

    expect(onSelectAllSlots).not.toHaveBeenCalled();
    expect(onClearSelectedSlots).toHaveBeenCalledTimes(1);
  });

  it("does not offer a per-block view (Por bloque)", () => {
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
            slots: ["10:00", "14:00", "18:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["10:00", "14:00", "18:00"]}
        selectedSlots={[]}
        isFullDaySelected={false}
        canSelectFullDay={true}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSelectDate={vi.fn()}
        onToggleSlot={vi.fn()}
        onSelectAllSlots={vi.fn()}
        onSelectFullDay={vi.fn()}
        onClearSelectedSlots={vi.fn()}
        onReasonChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Por bloque/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /10:00 AM/i })).toBeInTheDocument();
  });

  it("triggers full-day selection action", () => {
    const onSelectFullDay = vi.fn();

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
            slots: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"]}
        selectedSlots={[]}
        isFullDaySelected={false}
        canSelectFullDay={true}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onSelectDate={vi.fn()}
        onToggleSlot={vi.fn()}
        onSelectAllSlots={vi.fn()}
        onSelectFullDay={onSelectFullDay}
        onClearSelectedSlots={vi.fn()}
        onReasonChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /Día completo/i }));
    expect(onSelectFullDay).toHaveBeenCalledTimes(1);
  });
});
