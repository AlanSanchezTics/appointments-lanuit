"use client";

import { useCallback, useState } from "react";

import { useAdminAuth } from "@/hooks/admin/useAdminAuth";
import {
  resolveAdminAuthErrorKey,
  type AdminAuthErrorTranslationKey,
} from "@/lib/admin/auth/error-translation";

type LoginFormState = {
  username: string;
  password: string;
};

const DEFAULT_STATE: LoginFormState = {
  username: "",
  password: "",
};

export function useLoginForm() {
  const { login } = useAdminAuth();
  const [state, setState] = useState<LoginFormState>(DEFAULT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<AdminAuthErrorTranslationKey | null>(
    null
  );

  const updateField = useCallback((field: keyof LoginFormState, value: string) => {
    setState((current) => ({ ...current, [field]: value }));
    setErrorKey(null);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setErrorKey(null);

    try {
      if (!state.username.trim() || !state.password.trim()) {
        throw new Error("FORM_INCOMPLETE");
      }

      await login(state.username, state.password);
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      setErrorKey(resolveAdminAuthErrorKey(code));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [login, state.password, state.username]);

  return {
    state,
    isSubmitting,
    errorKey,
    updateField,
    submit,
  };
}
