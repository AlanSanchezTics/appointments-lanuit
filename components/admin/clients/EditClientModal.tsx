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
  initialPhone: string;
  labels: {
    title: string;
    close: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    save: string;
    saving: string;
    cancel: string;
    nameTooShort: string;
    phoneInvalid: string;
  };
  onClose: () => void;
  onSubmit: (payload: { name: string; phone: string }) => Promise<void>;
};

export function EditClientModal({
  isOpen,
  isSubmitting,
  initialName,
  initialPhone,
  labels,
  onClose,
  onSubmit,
}: EditClientModalProps) {
  const {
    name,
    setName,
    phone,
    setPhone,
    fieldError,
    reset,
    validate,
    getSanitizedPayload,
  } = useEditClientForm(initialName, initialPhone);

  useEffect(() => {
    if (isOpen) {
      reset(initialName, initialPhone);
    }
  }, [initialName, initialPhone, isOpen, reset]);

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
