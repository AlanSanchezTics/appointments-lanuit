import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Input } from "@/components/admin/ui/Input";
import { adminIcons } from "@/components/admin/ui/admin-icons";

describe("Input", () => {
  it("renders password toggle and switches visibility", () => {
    render(
      <Input
        id="admin-password"
        type="password"
        label="Contraseña"
        value="secret123"
        onChange={() => {}}
        icon={<AdminIcon icon={adminIcons.password} tone="secondary" />}
      />
    );

    const input = screen.getByLabelText("Contraseña");
    const toggleButton = screen.getByRole("button", {
      name: "Mostrar contraseña",
    });

    expect(input).toHaveAttribute("type", "password");
    expect(document.querySelector('svg[data-icon="lock"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="eye"]')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", {
        name: "Ocultar contraseña",
      })
    ).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="eye-slash"]')).toBeInTheDocument();
  });

  it("does not render password toggle on non-password inputs", () => {
    render(
      <Input
        id="admin-username"
        type="text"
        label="Usuario"
        value=""
        onChange={() => {}}
        icon={<AdminIcon icon={adminIcons.username} tone="secondary" />}
      />
    );

    expect(screen.getByLabelText("Usuario")).toHaveAttribute("type", "text");
    expect(
      screen.queryByRole("button", { name: "Mostrar contraseña" })
    ).not.toBeInTheDocument();
  });
});
