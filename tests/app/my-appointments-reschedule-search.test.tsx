import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyAppointmentsFlow } from "@/components/my-appointments/my-appointments-flow";
import { fetchMonthAvailability } from "@/lib/booking/api-client";
import {
  lookupMyAppointments,
  rescheduleMyAppointment,
} from "@/lib/my-appointments/api-client";

vi.mock("@/lib/my-appointments/api-client", () => ({
  lookupMyAppointments: vi.fn(),
  cancelMyAppointments: vi.fn(),
  rescheduleMyAppointment: vi.fn(),
}));

vi.mock("@/lib/booking/api-client", () => ({
  fetchMonthAvailability: vi.fn(),
}));

const marchDays = [
  { date: "2026-03-04", slots: ["09:00", "13:00"] },
  { date: "2026-03-05", slots: ["10:00", "14:00"] },
  { date: "2026-03-06", slots: ["10:00"] },
];
const aprilDaysNoTen = [{ date: "2026-04-07", slots: ["13:00"] }];
// 14:00 is not the first slot of 04 or 05, so keeping it is distinguishable from the first-slot rule.
const keepDays = [
  { date: "2026-03-04", slots: ["09:00", "14:00"] },
  { date: "2026-03-05", slots: ["10:00", "14:00"] },
  { date: "2026-03-06", slots: ["10:00"] },
];

const appointment = {
  appointmentId: 7,
  name: "Ana",
  phone: "3221234567",
  date: "2026-03-10",
  timeSlot: "16:00",
  status: "CONFIRMED" as const,
  canCancel: false,
  canModify: true,
  isBlocked: false,
};

function dayButton(n: number) {
  const label = String(n).padStart(2, "0");
  return screen.getAllByRole("button").find((b) => b.textContent === label)!;
}

function chip(slot: string, daysLabel: string) {
  return screen.getByRole("button", {
    name: new RegExp(`^Seleccionar horario ${slot}, ${daysLabel}$`),
  });
}

async function openReschedule() {
  fireEvent.change(document.getElementById("my-appointments-phone")!, {
    target: { value: "322 123 4567" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Buscar citas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Modificar cita" }));
  await waitFor(() => expect(dayButton(4)).toBeEnabled());
}

describe("my-appointments reschedule: search mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupMyAppointments).mockResolvedValue({ appointments: [appointment] });
    vi.mocked(fetchMonthAvailability).mockImplementation(async (month: string) =>
      month === "2026-04" ? aprilDaysNoTen : marchDays,
    );
    vi.mocked(rescheduleMyAppointment).mockResolvedValue(undefined as never);
  });

  it("starts in Por día without time chips", async () => {
    render(<MyAppointmentsFlow availableMonths={["2026-03", "2026-04"]} />);
    await openReschedule();

    expect(screen.getByRole("button", { name: "Por día" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Por horario" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("2 días")).toBeNull();
  });

  it("Por horario: the chosen slot enables only its days; confirm needs a valid choice", async () => {
    render(<MyAppointmentsFlow availableMonths={["2026-03", "2026-04"]} />);
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    expect(chip("09:00 AM", "1 día")).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(4)).toBeEnabled();
    expect(dayButton(5)).toBeDisabled();

    fireEvent.click(chip("10:00 AM", "2 días"));
    expect(chip("10:00 AM", "2 días")).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(4)).toBeDisabled();
    expect(dayButton(5)).toBeEnabled();
    expect(dayButton(6)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirmar cambio" })).toBeEnabled();
  });

  it("month change without the chosen slot disables days and confirm; returning revives it", async () => {
    render(<MyAppointmentsFlow availableMonths={["2026-03", "2026-04"]} />);
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    fireEvent.click(chip("10:00 AM", "2 días"));

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await waitFor(() =>
      expect(screen.getByText("Elige un horario para ver sus días disponibles")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar cambio" })).toBeDisabled(),
    );
    expect(dayButton(7)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar cambio" })).toBeEnabled(),
    );
    expect(chip("10:00 AM", "2 días")).toHaveAttribute("aria-pressed", "true");
  });

  it("sends the date that carries the chosen slot", async () => {
    render(
      <MyAppointmentsFlow
        availableMonths={["2026-03", "2026-04"]}
        onWhatsAppRedirect={vi.fn()}
      />,
    );
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    fireEvent.click(chip("10:00 AM", "2 días"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));

    await waitFor(() =>
      expect(rescheduleMyAppointment).toHaveBeenCalledWith({
        phone: "3221234567",
        appointmentId: 7,
        month: "2026-03",
        date: "2026-03-05",
        timeSlot: "10:00",
      }),
    );
  });

  it("re-entering the reschedule step restarts in Por día", async () => {
    render(<MyAppointmentsFlow availableMonths={["2026-03", "2026-04"]} />);
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "Por horario" }));
    fireEvent.click(screen.getByRole("button", { name: "Regresar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Modificar cita" }));

    await waitFor(() => expect(dayButton(4)).toBeEnabled());
    expect(screen.getByRole("button", { name: "Por día" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("2 días")).toBeNull();
  });

  it("Por día keeps the chosen time when the newly picked day offers it", async () => {
    vi.mocked(fetchMonthAvailability).mockImplementation(async () => keepDays);
    render(
      <MyAppointmentsFlow
        availableMonths={["2026-03", "2026-04"]}
        onWhatsAppRedirect={vi.fn()}
      />,
    );
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "02:00 PM" }));
    fireEvent.click(dayButton(5));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));

    await waitFor(() =>
      expect(rescheduleMyAppointment).toHaveBeenCalledWith({
        phone: "3221234567",
        appointmentId: 7,
        month: "2026-03",
        date: "2026-03-05",
        timeSlot: "14:00",
      }),
    );
  });

  it("Por día falls back to the first slot when the newly picked day does not offer the chosen time", async () => {
    vi.mocked(fetchMonthAvailability).mockImplementation(async () => keepDays);
    render(
      <MyAppointmentsFlow
        availableMonths={["2026-03", "2026-04"]}
        onWhatsAppRedirect={vi.fn()}
      />,
    );
    await openReschedule();

    fireEvent.click(screen.getByRole("button", { name: "02:00 PM" }));
    fireEvent.click(dayButton(6));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));

    await waitFor(() =>
      expect(rescheduleMyAppointment).toHaveBeenCalledWith({
        phone: "3221234567",
        appointmentId: 7,
        month: "2026-03",
        date: "2026-03-06",
        timeSlot: "10:00",
      }),
    );
  });
});
