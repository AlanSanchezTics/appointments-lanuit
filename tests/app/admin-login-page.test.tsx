import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    errorMessage: null,
    updateField: vi.fn(),
    submit: vi.fn(),
  }),
}));

describe("admin login page", () => {
  it("renders login form fields and action button", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});
