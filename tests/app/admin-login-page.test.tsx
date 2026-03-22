import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18next from "i18next";

import { LoginForm } from "@/components/admin/auth/LoginForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/admin/useLoginForm", () => ({
  useLoginForm: () => ({
    state: {
      username: "",
      password: "",
    },
    isSubmitting: false,
    errorKey: null,
    updateField: vi.fn(),
    submit: vi.fn(),
  }),
}));

describe("admin login page", () => {
  it("renders login form fields and action button", () => {
    void i18next.changeLanguage("es");
    render(<LoginForm />);

    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="user"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="lock"]')).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mostrar contraseña" })
    ).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="eye"]')).toBeInTheDocument();
  });

  it("renders English labels when language changes to en", async () => {
    await act(async () => {
      await i18next.changeLanguage("en");
    });
    render(<LoginForm />);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();

    await act(async () => {
      await i18next.changeLanguage("es");
    });
  });
});
