import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRescheduleWhatsappAction } from "@/hooks/admin/months/useRescheduleWhatsappAction";

const sileoMock = vi.hoisted(() => ({ action: vi.fn() }));

vi.mock("sileo", () => ({ sileo: sileoMock }));

describe("useRescheduleWhatsappAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("offers a sileo action that opens wa.me with the new date and time only when clicked", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("location", { assign: assignMock });

    const { result } = renderHook(() => useRescheduleWhatsappAction());

    result.current.offerRescheduleWhatsapp({
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "10:00",
    });

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
      "🗓️ *Nos vemos el Miércoles, 18 de Marzo a las 10:00 am*!",
    );
  });
});
