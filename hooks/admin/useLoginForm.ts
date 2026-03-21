"use client";

import { useCallback, useState } from "react";

import { useAdminAuth } from "@/hooks/admin/useAdminAuth";

type LoginFormState = {
  username: string;
  password: string;
};

const DEFAULT_STATE: LoginFormState = {
  username: "",
  password: "",
};

function translateErrorCode(code: string) {
  switch (code) {
    case "FORM_INCOMPLETE":
      return "Completa usuario y contraseña.";
    case "INVALID_CREDENTIALS":
      return "Usuario o contraseña inválidos.";
    case "ADMIN_USER_INACTIVE":
      return "La cuenta administrativa está deshabilitada.";
    default:
      return "No fue posible iniciar sesión.";
  }
}

export function useLoginForm() {
  const { login } = useAdminAuth();
  const [state, setState] = useState<LoginFormState>(DEFAULT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = useCallback((field: keyof LoginFormState, value: string) => {
    setState((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!state.username.trim() || !state.password.trim()) {
        throw new Error("FORM_INCOMPLETE");
      }

      await login(state.username, state.password);
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      setErrorMessage(translateErrorCode(code));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [login, state.password, state.username]);

  return {
    state,
    isSubmitting,
    errorMessage,
    updateField,
    submit,
  };
}
