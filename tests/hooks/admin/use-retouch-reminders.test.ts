import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRetouchReminders } from "@/hooks/admin/useRetouchReminders";

describe("useRetouchReminders", () => {
  it("builds expected whatsapp url and opens it", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign: assignMock,
      },
    });

    const t = vi.fn(() => "Hola Ana ✨\nLa siguiente semana se cumple el mes de tus uñas, agendamos tu retoque? 😉");
    const { result } = renderHook(() => useRetouchReminders({ t: t as never }));
    result.current.sendRetouchReminder({
      clientId: 10,
      clientNumber: 1200,
      name: "Ana",
      phone: "5512345678",
      lastAppointmentDate: "2026-03-09",
      candidateReason: "NO_CONFIRMED_IN_31_DAYS",
    });

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(t).toHaveBeenCalledWith("dashboard.retouchReminders.whatsapp.message", {
      name: "Ana",
    });
    expect(assignMock).toHaveBeenCalledWith(
      "https://wa.me/525512345678?text=Hola%20Ana%20%E2%9C%A8%0ALa%20siguiente%20semana%20se%20cumple%20el%20mes%20de%20tus%20u%C3%B1as%2C%20agendamos%20tu%20retoque%3F%20%F0%9F%98%89",
    );
  });
});
