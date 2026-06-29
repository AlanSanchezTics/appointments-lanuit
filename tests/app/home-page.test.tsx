import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { listHomeAvailableMonths } from "@/lib/home/service";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    toString: () => "app_lang=es",
  })),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: ComponentProps<"img">) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("@/lib/i18n/language", () => ({
  resolveServerLanguage: vi.fn(() => "es"),
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerT: vi.fn(async () => ((key: string) => {
    const translations: Record<string, string> = {
      "home.welcome": "✨ Bienvenida ✨",
      "home.title": "Reserva tu cita en los meses disponibles.",
      "home.subtitle":
        "¡No dejes pasar el tiempo y agenda tu cita antes de que sea demasiado tarde!",
      "home.orSeparator": "- o -",
      "bookingEntry.book": "Agendar cita",
      "home.cancel": "Cancelar cita",
      "home.manageOrCancel": "Consultar o cancelar cita",
      "home.unavailableHint": "En cuanto haya nuevos meses activos podrás continuar con tu reserva desde aquí.",
      "home.unavailableMessage":
        "Agenda no disponible por el momento, contactanos por WhatsApp para más información.",
    };

    return translations[key] ?? key;
  }) as never),
}));

vi.mock("@/lib/home/service", () => ({
  listHomeAvailableMonths: vi.fn(),
}));

const listHomeAvailableMonthsMock = vi.mocked(listHomeAvailableMonths);

describe("home page", () => {
  it("renders booking and cancellation CTAs", async () => {
    listHomeAvailableMonthsMock.mockResolvedValueOnce(["2026-03", "2026-04"]);

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Agendar cita" })).toHaveAttribute(
      "href",
      "/booking",
    );
    expect(screen.getByRole("link", { name: "Consultar o cancelar cita" })).toHaveAttribute(
      "href",
      "/my-appointments",
    );
  });

  it("shows unavailable hint when no months can be booked", async () => {
    listHomeAvailableMonthsMock.mockResolvedValueOnce([]);

    render(await HomePage());

    expect(
      screen.getByText(
        "En cuanto haya nuevos meses activos podrás continuar con tu reserva desde aquí.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar o cancelar cita" })).toHaveAttribute(
      "href",
      "/my-appointments",
    );
  });
});
