import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReminderAppointmentsCard } from "@/components/admin/ui/ReminderAppointmentsCard";
import type { DashboardReminderItem } from "@/lib/admin/dashboard/types";

const sileoSpies = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("sileo", () => ({
  sileo: {
    success: sileoSpies.success,
    warning: sileoSpies.warning,
    error: sileoSpies.error,
  },
}));

const reminderItem: DashboardReminderItem = {
  appointmentId: 42,
  clientNumber: 1001,
  date: "2026-05-02",
  timeSlot: "10:00",
  name: "Ana Garcia",
  phone: "5512345678",
  reminderType: "NEXT_DAY",
  reminderSent: false,
};

describe("ReminderAppointmentsCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sileoSpies.success.mockClear();
    sileoSpies.warning.mockClear();
    sileoSpies.error.mockClear();
  });

  it("opens the final WhatsApp URL before tracking the reminder", async () => {
    const callOrder: string[] = [];
    let openedUrl = "";

    vi.spyOn(window, "open").mockImplementation((url) => {
      callOrder.push("open");
      openedUrl = String(url ?? "");
      return {} as Window;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callOrder.push("fetch");
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

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

    expect(callOrder[0]).toBe("open");

    await waitFor(() => {
      expect(callOrder).toEqual(["open", "fetch"]);
      expect(openedUrl).toContain("https://wa.me/525512345678");
    });
  });

  it("keeps the direct WhatsApp opening when reminder tracking fails", async () => {
    let openedUrl = "";

    vi.spyOn(window, "open").mockImplementation((url) => {
      openedUrl = String(url ?? "");
      return {} as Window;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ errorCode: "APPOINTMENT_REMINDER_ALREADY_SENT" }),
          { status: 409 },
        );
      }),
    );

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

    await waitFor(() => {
      expect(openedUrl).toContain("https://wa.me/525512345678");
      expect(sileoSpies.warning).toHaveBeenCalled();
    });
  });
});
