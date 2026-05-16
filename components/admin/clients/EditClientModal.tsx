"use client";

import { FormEvent, useEffect } from "react";

import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";
import { Modal } from "@/components/admin/ui/Modal";
import { useEditClientForm } from "@/hooks/admin/clients/useEditClientForm";

type EditClientModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  initialName: string;
  initialAlias: string | null;
  initialPhone: string;
  initialClientNumber: number;
  serverErrorCode: string | null;
  labels: {
    title: string;
    close: string;
    nameLabel: string;
    namePlaceholder: string;
    aliasLabel: string;
    aliasPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    clientNumberLabel: string;
    clientNumberPlaceholder: string;
    save: string;
    saving: string;
    cancel: string;
    nameTooShort: string;
    aliasTooLong: string;
    phoneInvalid: string;
    clientNumberInvalid: string;
    clientNumberAlreadyExists: string;
  };
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    alias: string | null;
    phone: string;
    clientNumber: number;
  }) => Promise<void>;
};

export function EditClientModal({
  isOpen,
  isSubmitting,
  initialName,
  initialAlias,
  initialPhone,
  initialClientNumber,
  serverErrorCode,
  labels,
  onClose,
  onSubmit,
}: EditClientModalProps) {
  const {
    name,
    setName,
    alias,
    setAlias,
    phone,
    setPhone,
    clientNumber,
    setClientNumber,
    fieldError,
    reset,
    applyServerError,
    validate,
    getSanitizedPayload,
  } = useEditClientForm(
    initialName,
    initialAlias,
    initialPhone,
    initialClientNumber,
  );

  useEffect(() => {
    if (isOpen) {
      reset(initialName, initialAlias, initialPhone, initialClientNumber);
    }
  }, [initialAlias, initialClientNumber, initialName, initialPhone, isOpen, reset]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    applyServerError(serverErrorCode);
  }, [applyServerError, isOpen, serverErrorCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(getSanitizedPayload());
  }

  return (
    <Modal
      isOpen={isOpen}
      title={labels.title}
      closeLabel={labels.close}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          id="edit-client-name"
          label={labels.nameLabel}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={labels.namePlaceholder}
          disabled={isSubmitting}
          error={fieldError.name ? labels.nameTooShort : null}
          className="!h-11 !rounded-xl !bg-[var(--admin-surface)] !px-3 !py-0 !text-sm !font-medium !tracking-normal !text-[var(--admin-text-primary)]"
        />

        <Input
          id="edit-client-phone"
          label={labels.phoneLabel}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={labels.phonePlaceholder}
          disabled={isSubmitting}
          inputMode="numeric"
          autoComplete="tel-national"
          error={fieldError.phone ? labels.phoneInvalid : null}
          className="!h-11 !rounded-xl !bg-[var(--admin-surface)] !px-3 !py-0 !text-sm !font-medium !tracking-normal !text-[var(--admin-text-primary)]"
        />

        <Input
          id="edit-client-number"
          label={labels.clientNumberLabel}
          value={clientNumber}
          onChange={(event) => setClientNumber(event.target.value)}
          placeholder={labels.clientNumberPlaceholder}
          disabled={isSubmitting}
          inputMode="numeric"
          error={fieldError.clientNumber
            ? fieldError.clientNumber === "CLIENT_NUMBER_ALREADY_EXISTS"
              ? labels.clientNumberAlreadyExists
              : labels.clientNumberInvalid
            : null}
          className="!h-11 !rounded-xl !bg-[var(--admin-surface)] !px-3 !py-0 !text-sm !font-medium !tracking-normal !text-[var(--admin-text-primary)]"
        />

        <Input
          id="edit-client-alias"
          label={labels.aliasLabel}
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder={labels.aliasPlaceholder}
          disabled={isSubmitting}
          error={fieldError.alias ? labels.aliasTooLong : null}
          className="!h-11 !rounded-xl !bg-[var(--admin-surface)] !px-3 !py-0 !text-sm !font-medium !tracking-normal !text-[var(--admin-text-primary)]"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={isSubmitting}
          >
            {labels.cancel}
          </Button>
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? labels.saving : labels.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
