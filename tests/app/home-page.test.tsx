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
      "home.cancel": "Cancelar cita",
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

vi.mock("@/lib/datetime/mexico-city", () => ({
  formatMonthLabel: vi.fn((month: string) => month),
}));

const listHomeAvailableMonthsMock = vi.mocked(listHomeAvailableMonths);

describe("home page", () => {
  it("renders month entry links and cancellation CTA", async () => {
    listHomeAvailableMonthsMock.mockResolvedValueOnce(["2026-03", "2026-04"]);

    render(await HomePage());

    expect(screen.getByRole("link", { name: "2026-03" })).toHaveAttribute(
      "href",
      "/citas/2026-03/booking",
    );
    expect(screen.getByRole("link", { name: "2026-04" })).toHaveAttribute(
      "href",
      "/citas/2026-04/booking",
    );
    expect(screen.getByRole("link", { name: "Cancelar cita" })).toHaveAttribute(
      "href",
      "/citas/cancelar",
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
    expect(screen.getByRole("link", { name: "Cancelar cita" })).toHaveAttribute(
      "href",
      "/citas/cancelar",
    );
  });
});
