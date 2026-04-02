"use client";

import { useCallback, useMemo, useState } from "react";

type EditClientFieldError = {
  name: string | null;
  phone: string | null;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function useEditClientForm(initialName: string, initialPhone: string) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [fieldError, setFieldError] = useState<EditClientFieldError>({
    name: null,
    phone: null,
  });

  const isValid = useMemo(
    () => name.trim().length >= 3 && /^[0-9]{10}$/.test(normalizePhone(phone)),
    [name, phone],
  );

  const reset = useCallback((nextName: string, nextPhone: string) => {
    setName(nextName);
    setPhone(nextPhone);
    setFieldError({
      name: null,
      phone: null,
    });
  }, []);

  const validate = useCallback(() => {
    const trimmedName = name.trim();
    const normalizedPhone = normalizePhone(phone);

    const nextError: EditClientFieldError = {
      name: null,
      phone: null,
    };

    if (trimmedName.length < 3) {
      nextError.name = "CLIENT_NAME_TOO_SHORT";
    }

    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      nextError.phone = "VALIDATION_PHONE_INVALID";
    }

    if (nextError.name || nextError.phone) {
      setFieldError(nextError);
      return false;
    }

    setFieldError({
      name: null,
      phone: null,
    });
    return true;
  }, [name, phone]);

  const getSanitizedPayload = useCallback(() => {
    return {
      name: name.trim(),
      phone: normalizePhone(phone),
    };
  }, [name, phone]);

  return {
    name,
    setName,
    phone,
    setPhone,
    fieldError,
    isValid,
    reset,
    validate,
    getSanitizedPayload,
  };
}
