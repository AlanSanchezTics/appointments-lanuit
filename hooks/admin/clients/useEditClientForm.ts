"use client";

import { useCallback, useMemo, useState } from "react";

export function useEditClientForm(initialName: string) {
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isValid = useMemo(() => name.trim().length >= 3, [name]);

  const reset = useCallback((nextName: string) => {
    setName(nextName);
    setFieldError(null);
  }, []);

  const validate = useCallback(() => {
    if (name.trim().length < 3) {
      setFieldError("CLIENT_NAME_TOO_SHORT");
      return false;
    }

    setFieldError(null);
    return true;
  }, [name]);

  return {
    name,
    setName,
    fieldError,
    isValid,
    reset,
    validate,
  };
}
