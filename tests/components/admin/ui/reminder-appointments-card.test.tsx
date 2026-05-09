import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReminderAppointmentsCard } from "@/components/admin/ui/ReminderAppointmentsCard";
import type { DashboardReminderItem } from "@/lib/admin/dashboard/types";

const reminderItem: DashboardReminderItem = {
  appointmentId: 42,
  clientNumber: 1001,
  date: "2026-05-02",
  timeSlot: "10:00",
  name: "Ana Garcia",
  phone: "5512345678",
  reminderType: "NEXT_DAY",
};

describe("ReminderAppointmentsCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the final WhatsApp URL directly from click", () => {
    const assignMock = vi.fn();
    vi.spyOn(window.location, "assign").mockImplementation(assignMock);

    render(
      <ReminderAppointmentsCard
        language="es"
        nextDayItems={[reminderItem]}
        nextWeekItems={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Enviar recordatorio a Ana Garcia",
      }),
    );

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(String(assignMock.mock.calls[0]?.[0] ?? "")).toContain(
      "https://wa.me/525512345678",
    );
  });
});
