import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditClientModal } from "@/components/admin/clients/EditClientModal";

const labels = {
  title: "Editar cliente",
  close: "Cerrar edición de cliente",
  nameLabel: "Nombre",
  namePlaceholder: "Nombre completo",
  phoneLabel: "Teléfono",
  phonePlaceholder: "322 123 4567",
  save: "Guardar",
  saving: "Guardando...",
  cancel: "Cancelar",
  nameTooShort: "El nombre debe tener al menos 3 caracteres.",
  phoneInvalid: "El teléfono debe tener 10 dígitos.",
};

describe("EditClientModal", () => {
  it("validates minimum name length before submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialPhone="5512345678"
        labels={labels}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Al" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText("El nombre debe tener al menos 3 caracteres."),
    ).toBeInTheDocument();
  });

  it("submits trimmed name when input is valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialPhone="5512345678"
        labels={labels}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "  Ana María  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Ana María",
        phone: "5512345678",
      });
    });
  });

  it("validates phone before submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialPhone="5512345678"
        labels={labels}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "55123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText("El teléfono debe tener 10 dígitos."),
    ).toBeInTheDocument();
  });
});
