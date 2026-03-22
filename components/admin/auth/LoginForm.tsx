"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";

import Logo from "@/assets/images/logo.png";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useLoginForm } from "@/hooks/admin/useLoginForm";

export function LoginForm() {
  const { t } = useTranslation(["admin", "adminErrors"]);
  const router = useRouter();
  const { state, isSubmitting, errorKey, updateField, submit } =
    useLoginForm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didLogin = await submit();

    if (didLogin) {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--admin-canvas)] px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src={Logo}
            alt={t("auth.login.logoAlt", { ns: "admin" })}
            width={220}
            height={160}
            className="h-28 w-auto object-contain"
            priority
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Input
            id="admin-username"
            type="text"
            autoComplete="username"
            placeholder={t("auth.login.usernamePlaceholder", { ns: "admin" })}
            label={t("auth.login.usernameLabel", { ns: "admin" })}
            value={state.username}
            onChange={(event) => updateField("username", event.target.value)}
            icon={<AdminIcon icon={adminIcons.username} tone="secondary" />}
          />

          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            placeholder={t("auth.login.passwordPlaceholder", { ns: "admin" })}
            label={t("auth.login.passwordLabel", { ns: "admin" })}
            value={state.password}
            onChange={(event) => updateField("password", event.target.value)}
            icon={<AdminIcon icon={adminIcons.password} tone="secondary" />}
          />

          {errorKey ? (
            <p
              className="rounded-xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm font-medium text-[var(--error)]"
              role="alert"
            >
              {t(errorKey, { ns: "adminErrors" })}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("auth.login.submitting", { ns: "admin" })
              : t("auth.login.submit", { ns: "admin" })}
          </Button>
        </form>
      </div>
    </main>
  );
}
