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
  labels: {
    title: string;
    close: string;
    nameLabel: string;
    namePlaceholder: string;
    save: string;
    saving: string;
    cancel: string;
    nameTooShort: string;
  };
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export function EditClientModal({
  isOpen,
  isSubmitting,
  initialName,
  labels,
  onClose,
  onSubmit,
}: EditClientModalProps) {
  const { name, setName, fieldError, reset, validate } = useEditClientForm(initialName);

  useEffect(() => {
    if (isOpen) {
      reset(initialName);
    }
  }, [initialName, isOpen, reset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(name.trim());
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
          error={fieldError ? labels.nameTooShort : null}
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
