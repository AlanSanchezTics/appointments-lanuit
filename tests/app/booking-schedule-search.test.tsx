import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const marchDays = [
  { date: "2026-03-04", slots: ["09:00", "13:00"] },
  { date: "2026-03-05", slots: ["10:00", "14:00"] },
  { date: "2026-03-06", slots: ["10:00"] },
];
const aprilDaysNoThirteen = [{ date: "2026-04-07", slots: ["10:00"] }];

const emptyDraft = { date: null, timeSlot: null, name: "", phone: "" };

function dayButton(n: number) {
  const label = String(n).padStart(2, "0");
  return screen.getAllByRole("button").find((b) => b.textContent === label)!;
}

function chipFor(text: string) {
  return screen.getByText(text).closest("button")!;
}

describe("booking schedule search", () => {
  it("time mode lists chips with plural counts and aria-pressed; day buttons gate by slot", async () => {
    render(<BookingWizard days={marchDays} month="2026-03" initialDraft={emptyDraft} />);

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    expect(screen.getByRole("button", { name: "Por horario" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Por día" })).toHaveAttribute("aria-pressed", "false");

    expect(chipFor("2 días")).toBeTruthy(); // 10:00 on two days
    expect(screen.getAllByText("1 día").length).toBe(3); // 09:00, 13:00, 14:00
    expect(screen.getByText("02:00 PM").closest("button")).not.toBeNull();

    // No slot chosen: Siguiente disabled, all days disabled.
    expect(screen.getByRole("button", { name: /^Siguiente$/ })).toBeDisabled();
    expect(dayButton(4)).toBeDisabled();
    expect(dayButton(5)).toBeDisabled();
    expect(screen.getByText("Elige un horario para ver sus días disponibles")).toBeInTheDocument();

    // Pick 10:00: days 5 and 6 enabled, 4 disabled.
    const ten = chipFor("2 días");
    fireEvent.click(ten);
    expect(ten).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(4)).toBeDisabled();
    expect(dayButton(5)).toBeEnabled();
    expect(dayButton(6)).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Siguiente$/ })).toBeEnabled();
  });

  it("reaches identity from time mode without touching intermediate days, then Regresar resets to Por día", async () => {
    render(<BookingWizard days={marchDays} month="2026-03" initialDraft={emptyDraft} />);

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    fireEvent.click(screen.getByText("09:00 AM").closest("button")!); // only 4 has it
    expect(dayButton(4)).toBeEnabled();
    expect(dayButton(5)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/ }));
    expect(
      await screen.findByRole("heading", { name: "Cuéntanos un poco sobre ti" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Regresar" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Por día" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("button", { name: "Por horario" })).toHaveAttribute("aria-pressed", "false");
  });

  it("month change: missing slot disables days and Siguiente; returning to a month with it revives the choice", async () => {
    const refreshDays = vi.fn(async (month: string) =>
      month === "2026-04" ? aprilDaysNoThirteen : marchDays,
    );
    render(
      <BookingWizard
        days={marchDays}
        month="2026-03"
        availableMonths={["2026-03", "2026-04"]}
        initialDraft={emptyDraft}
        refreshDays={refreshDays}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    fireEvent.click(screen.getAllByText("01:00 PM")[0].closest("button")!);
    expect(screen.getByRole("button", { name: /^Siguiente$/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: i18next.t("booking.nextMonth") }));
    await waitFor(() => expect(refreshDays).toHaveBeenCalledWith("2026-04"));
    await waitFor(() =>
      expect(screen.getByText("Elige un horario para ver sus días disponibles")).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^Siguiente$/ })).toBeDisabled());
    expect(dayButton(7)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: i18next.t("booking.previousMonth") }));
    await waitFor(() => expect(refreshDays).toHaveBeenCalledWith("2026-03"));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Siguiente$/ })).toBeEnabled());
    // Documents current behavior: the 13:00 choice silently returns.
    expect(screen.getAllByText("01:00 PM")[0].closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("en: plural and labels", async () => {
    await i18next.changeLanguage("en");
    try {
      render(<BookingWizard days={marchDays} month="2026-03" initialDraft={emptyDraft} />);
      fireEvent.click(screen.getByRole("button", { name: "By time" }));
      expect(screen.getByText("2 days")).toBeInTheDocument();
      expect(screen.getAllByText("1 day").length).toBe(3);
    } finally {
      await i18next.changeLanguage("es");
    }
  });
});
