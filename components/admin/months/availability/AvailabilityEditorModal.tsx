"use client";

import { useTranslation } from "react-i18next";

import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { AffectedAppointmentsDialog } from "@/components/admin/months/availability/AffectedAppointmentsDialog";
import { AvailabilityExceptionForm } from "@/components/admin/months/availability/AvailabilityExceptionForm";
import { AvailabilityRuleForm } from "@/components/admin/months/availability/AvailabilityRuleForm";
import {
  resolveAvailabilityErrorKey,
  type AvailabilityEditorApi,
} from "@/hooks/admin/months/useAvailabilityEditor";
import type { AvailabilitySaveApi } from "@/hooks/admin/months/useAvailabilitySave";
import { useDiscardConfirmDialog } from "@/hooks/admin/months/useDiscardConfirmDialog";

type AvailabilityEditorModalProps = {
  month: string;
  editor: AvailabilityEditorApi;
  save: AvailabilitySaveApi;
};

// Presentacional: el estado y el guardado viven en useAvailabilityEditor y useAvailabilitySave (AGENTS, reglas de hooks).
export function AvailabilityEditorModal({ month, editor, save }: AvailabilityEditorModalProps) {
  const { t } = useTranslation("admin");
  const isLocked = save.isBusy;
  const isFormReady = !editor.isLoading && editor.loadErrorCode === null;
  const discardDialog = useDiscardConfirmDialog({
    isOpen: editor.isDiscardConfirmOpen,
    onKeepEditing: editor.keepEditing,
  });

  return (
    <>
      <BottomSheetModal
        isOpen={editor.isOpen}
        title={t("monthsDetail.availability.title")}
        closeLabel={t("monthsDetail.availability.close")}
        onClose={editor.requestClose}
        disableClose={isLocked || save.isConfirmOpen || editor.isDiscardConfirmOpen}
        overlay={
          editor.isDiscardConfirmOpen ? (
            <>
              {/* Scrim sin manejador de clic: tocarlo no descarta ni cierra. Color = el backdrop de BottomSheetModal/Modal (no hay token de scrim). */}
              <div
                aria-hidden="true"
                className="absolute inset-0 z-10 rounded-t-3xl bg-[rgba(28,25,23,0.35)] backdrop-blur-sm"
              />
              <div
                ref={discardDialog.dialogRef}
                role="alertdialog"
                aria-labelledby={discardDialog.titleId}
                aria-describedby={discardDialog.descriptionId}
                className="absolute inset-x-4 top-4 z-20 mx-auto max-w-md"
              >
                <Card className="flex flex-col gap-3">
                  <h3 id={discardDialog.titleId} className="text-sm font-bold text-[var(--admin-text-primary)]">
                    {t("monthsDetail.availability.discard.title")}
                  </h3>
                  <p id={discardDialog.descriptionId} className="text-sm font-medium text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.availability.discard.description")}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="primary" data-initial-focus onClick={editor.keepEditing}>
                      {t("monthsDetail.availability.discard.keep")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={editor.close}>
                      {t("monthsDetail.availability.discard.confirm")}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          ) : null
        }
      >
        {/* inert: mientras la confirmación está abierta el contenido no recibe foco ni clics ni lo lee el lector de pantalla. */}
        <div className="flex min-w-0 flex-col gap-6 overflow-x-clip pb-2" inert={editor.isDiscardConfirmOpen}>
          {editor.isLoading ? (
            <p className="text-sm font-medium text-[var(--admin-text-secondary)]" role="status">
              {t("monthsDetail.availability.loading")}
            </p>
          ) : null}

          {editor.loadErrorCode ? (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[var(--error)]" role="alert">
                {t("monthsDetail.availability.loadFailed")}
              </p>
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={editor.retry}>
                {t("monthsDetail.availability.retry")}
              </Button>
            </Card>
          ) : null}

          {isFormReady ? (
            <>
              {editor.usesDefaultRule ? (
                <Card>
                  <p className="text-sm font-medium text-[var(--admin-text-primary)]" role="status">
                    {t("monthsDetail.availability.defaultRuleNotice")}
                  </p>
                </Card>
              ) : null}

              <section className="flex min-w-0 flex-col gap-3">
                <h3 className="text-sm font-bold text-[var(--admin-text-primary)]">
                  {t("monthsDetail.availability.rulesSection")}
                </h3>
                {editor.rules.length === 0 ? (
                  <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.availability.rulesEmpty")}
                  </p>
                ) : null}
                {editor.rules.map((rule) => (
                  <AvailabilityRuleForm
                    key={rule.key}
                    month={month}
                    rule={rule}
                    errorCode={editor.ruleErrors[rule.key] ?? null}
                    disabled={isLocked}
                    onChange={(patch) => editor.updateRule(rule.key, patch)}
                    onRemove={() => editor.removeRule(rule.key)}
                  />
                ))}
                <Button type="button" variant="secondary" fullWidth disabled={isLocked} onClick={editor.addRule}>
                  {t("monthsDetail.availability.addRule")}
                </Button>
              </section>

              <section className="flex min-w-0 flex-col gap-3">
                <h3 className="text-sm font-bold text-[var(--admin-text-primary)]">
                  {t("monthsDetail.availability.exceptionsSection")}
                </h3>
                {editor.exceptions.length === 0 ? (
                  <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.availability.exceptionsEmpty")}
                  </p>
                ) : null}
                {editor.exceptions.map((exception) => (
                  <AvailabilityExceptionForm
                    key={exception.key}
                    month={month}
                    exception={exception}
                    errorCode={editor.exceptionErrors[exception.key] ?? null}
                    disabled={isLocked}
                    onChange={(patch) => editor.updateException(exception.key, patch)}
                    onRemove={() => editor.removeException(exception.key)}
                  />
                ))}
                <Button type="button" variant="secondary" fullWidth disabled={isLocked} onClick={editor.addException}>
                  {t("monthsDetail.availability.addException")}
                </Button>
              </section>

              {editor.configErrorCode ? (
                <p className="text-xs font-medium text-[var(--error)]" role="alert">
                  {t(resolveAvailabilityErrorKey(editor.configErrorCode))}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={isLocked} onClick={editor.requestClose}>
                  {t("monthsDetail.availability.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={
                    isLocked || !editor.isDirty || !editor.isValid || save.isConfirmOpen || editor.isDiscardConfirmOpen
                  }
                  onClick={save.requestSave}
                >
                  {isLocked ? t("monthsDetail.availability.saving") : t("monthsDetail.availability.save")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </BottomSheetModal>

      <AffectedAppointmentsDialog
        isOpen={save.isConfirmOpen}
        items={save.affectedAppointments}
        isBusy={save.isBusy}
        onConfirm={save.confirmSave}
        onCancel={save.cancelConfirm}
      />
    </>
  );
}
