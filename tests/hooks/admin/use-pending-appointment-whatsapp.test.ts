import { renderHook } from "@testing-library/react";
import i18next from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePendingAppointmentWhatsapp } from "@/hooks/admin/usePendingAppointmentWhatsapp";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import { formatLongDate } from "@/lib/datetime/mexico-city";

const sileoMock = vi.hoisted(() => ({ action: vi.fn() }));

vi.mock("sileo", () => ({ sileo: sileoMock }));

const item: AdminPendingAppointmentItem = {
  appointmentId: 91,
  clientNumber: 1234,
  date: "2026-03-31",
  timeSlot: "09:00",
  name: "Ana Garcia",
  phone: "5512345678",
};

describe("usePendingAppointmentWhatsapp", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("offers a sileo action in Spanish and opens wa.me only when clicked", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("location", { assign: assignMock });
    const t = i18next.getFixedT("es", "admin");

    const { result } = renderHook(() =>
      usePendingAppointmentWhatsapp({ language: "es", t }),
    );

    result.current.offerConfirmationWhatsapp(item);

    expect(sileoMock.action).toHaveBeenCalledTimes(1);
    const options = sileoMock.action.mock.calls[0][0];
    expect(options.title).toBe("¿Avisar a la clienta por WhatsApp?");
    expect(options.button.title).toBe("Enviar por WhatsApp");
    expect(assignMock).not.toHaveBeenCalled();

    options.button.onClick();

    expect(assignMock).toHaveBeenCalledTimes(1);
    const url = assignMock.mock.calls[0][0] as string;
    expect(url.startsWith("https://wa.me/525512345678?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      `🗓️ *Nos vemos el ${formatLongDate("2026-03-31", "es")} a las 09:00 AM*!`,
    );
  });

  it("uses the English copy and English date labels", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("location", { assign: assignMock });
    const t = i18next.getFixedT("en", "admin");

    const { result } = renderHook(() =>
      usePendingAppointmentWhatsapp({ language: "en", t }),
    );

    result.current.offerConfirmationWhatsapp(item);

    const options = sileoMock.action.mock.calls[0][0];
    expect(options.title).toBe("Notify the client on WhatsApp?");
    expect(options.button.title).toBe("Send on WhatsApp");

    options.button.onClick();

    const url = assignMock.mock.calls[0][0] as string;
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      `🗓️ *See you on ${formatLongDate("2026-03-31", "en")} at 09:00 AM*!`,
    );
  });
});
