import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditClientModal } from "@/components/admin/clients/EditClientModal";

const labels = {
  title: "Editar cliente",
  close: "Cerrar edición de cliente",
  nameLabel: "Nombre",
  namePlaceholder: "Nombre completo",
  aliasLabel: "Alias",
  aliasPlaceholder: "Apodo o nombre corto",
  phoneLabel: "Teléfono",
  phonePlaceholder: "322 123 4567",
  clientNumberLabel: "Número de cliente",
  clientNumberPlaceholder: "1001",
  save: "Guardar",
  saving: "Guardando...",
  cancel: "Cancelar",
  nameTooShort: "El nombre debe tener al menos 3 caracteres.",
  aliasTooLong: "El alias no puede exceder 100 caracteres.",
  phoneInvalid: "El teléfono debe tener 10 dígitos.",
  clientNumberInvalid: "Ingresa un número de cliente válido.",
  clientNumberAlreadyExists: "Este número de cliente ya está en uso.",
};

describe("EditClientModal", () => {
  it("validates minimum name length before submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialAlias={null}
        initialPhone="5512345678"
        initialClientNumber={1001}
        serverErrorCode={null}
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
        initialAlias={null}
        initialPhone="5512345678"
        initialClientNumber={1001}
        serverErrorCode={null}
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
        alias: null,
        phone: "5512345678",
        clientNumber: 1001,
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
        initialAlias={null}
        initialPhone="5512345678"
        initialClientNumber={1001}
        serverErrorCode={null}
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

  it("validates client number before submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialAlias={null}
        initialPhone="5512345678"
        initialClientNumber={1001}
        serverErrorCode={null}
        labels={labels}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Número de cliente"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText("Ingresa un número de cliente válido."),
    ).toBeInTheDocument();
  });

  it("shows duplicate client number error from backend", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("CLIENT_NUMBER_ALREADY_EXISTS"));

    render(
      <EditClientModal
        isOpen
        isSubmitting={false}
        initialName="Ana"
        initialAlias={null}
        initialPhone="5512345678"
        initialClientNumber={1001}
        serverErrorCode="CLIENT_NUMBER_ALREADY_EXISTS"
        labels={labels}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByText("Este número de cliente ya está en uso."),
    ).toBeInTheDocument();
  });
});
