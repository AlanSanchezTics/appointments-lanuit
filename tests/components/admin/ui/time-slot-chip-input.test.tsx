import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TimeSlotChipInput } from "@/components/admin/ui/TimeSlotChipInput";

function Harness({ initial, onChange }: { initial: string[]; onChange?: (values: string[]) => void }) {
  const [values, setValues] = useState(initial);

  return (
    <TimeSlotChipInput
      id="times"
      label="Horario"
      values={values}
      onChange={(next) => {
        onChange?.(next);
        setValues(next);
      }}
      addLabel="Agregar hora"
      removeLabel="Quitar hora"
    />
  );
}

function timeInput() {
  return screen.getByLabelText("Horario") as HTMLInputElement;
}

function setTime(value: string) {
  fireEvent.change(timeInput(), { target: { value } });
}

function addButton() {
  return screen.getByRole("button", { name: "Agregar hora" });
}

function chipTexts() {
  return screen.queryAllByRole("listitem").map((item) => item.textContent);
}

describe("TimeSlotChipInput", () => {
  it("uses a single native time input and shows chips in 12 h while emitting HH:mm", () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(timeInput()).toHaveAttribute("type", "time");

    setTime("09:00");
    fireEvent.click(addButton());

    expect(onChange).toHaveBeenLastCalledWith(["09:00"]);
    expect(chipTexts()).toEqual(["9:00 AM"]);
  });

  it("converts afternoon times and keeps the list sorted by 24-hour value", () => {
    const onChange = vi.fn();
    render(<Harness initial={["14:00"]} onChange={onChange} />);

    setTime("13:30");
    fireEvent.click(addButton());
    expect(onChange).toHaveBeenLastCalledWith(["13:30", "14:00"]);

    setTime("12:15");
    fireEvent.click(addButton());
    expect(onChange).toHaveBeenLastCalledWith(["12:15", "13:30", "14:00"]);
    expect(chipTexts()).toEqual(["12:15 PM", "1:30 PM", "2:00 PM"]);
  });

  it("emits 00:00 for midnight (shown as 12:00 AM), which the editor engine rejects later", () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);

    setTime("00:00");
    fireEvent.click(addButton());

    expect(onChange).toHaveBeenLastCalledWith(["00:00"]);
    expect(chipTexts()).toEqual(["12:00 AM"]);
  });

  it("does not add duplicates and keeps the add button disabled while the input is empty", () => {
    const onChange = vi.fn();
    render(<Harness initial={["09:00"]} onChange={onChange} />);

    expect(addButton()).toBeDisabled();

    setTime("09:00");
    expect(addButton()).toBeEnabled();

    fireEvent.click(addButton());
    expect(onChange).not.toHaveBeenCalled();
    expect(chipTexts()).toEqual(["9:00 AM"]);
    expect(timeInput().value).toBe("");
  });

  it("exposes the add button as an icon-only primary control with an accessible name", () => {
    render(<Harness initial={[]} />);

    const button = addButton();
    expect(button).toHaveAccessibleName("Agregar hora");
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("adds on Enter, and removes a chip by its 12-hour accessible name", () => {
    render(<Harness initial={["09:00"]} />);

    setTime("17:00");
    fireEvent.keyDown(timeInput(), { key: "Enter" });
    expect(chipTexts()).toEqual(["9:00 AM", "5:00 PM"]);

    fireEvent.click(screen.getByRole("button", { name: "Quitar hora 9:00 AM" }));
    expect(chipTexts()).toEqual(["5:00 PM"]);
  });

  it("lays chips out in a three-column grid", () => {
    render(<Harness initial={["09:00", "10:00", "13:00"]} />);

    expect(screen.getByRole("list").className).toContain("grid-cols-3");
  });
});
