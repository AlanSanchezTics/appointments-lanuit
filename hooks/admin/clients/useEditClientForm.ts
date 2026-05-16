"use client";

import { useCallback, useMemo, useState } from "react";

type EditClientFieldError = {
  name: string | null;
  alias: string | null;
  phone: string | null;
  clientNumber: string | null;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeClientNumber(value: string) {
  return value.trim();
}

export function useEditClientForm(
  initialName: string,
  initialAlias: string | null,
  initialPhone: string,
  initialClientNumber: number,
) {
  const [name, setNameState] = useState(initialName);
  const [alias, setAliasState] = useState(initialAlias ?? "");
  const [phone, setPhoneState] = useState(initialPhone);
  const [clientNumber, setClientNumberState] = useState(String(initialClientNumber));
  const [fieldError, setFieldError] = useState<EditClientFieldError>({
    name: null,
    alias: null,
    phone: null,
    clientNumber: null,
  });

  const isValid = useMemo(
    () => {
      const normalizedClientNumber = normalizeClientNumber(clientNumber);

      if (!/^\d+$/.test(normalizedClientNumber)) {
        return false;
      }

      const parsedClientNumber = Number(normalizedClientNumber);

      return (
        name.trim().length >= 3
        && alias.trim().length <= 100
        && /^[0-9]{10}$/.test(normalizePhone(phone))
        && Number.isSafeInteger(parsedClientNumber)
        && parsedClientNumber > 0
      );
    },
    [alias, clientNumber, name, phone],
  );

  const setName = useCallback((value: string) => {
    setNameState(value);
    setFieldError((previous) => ({
      ...previous,
      name: null,
    }));
  }, []);

  const setPhone = useCallback((value: string) => {
    setPhoneState(value);
    setFieldError((previous) => ({
      ...previous,
      phone: null,
    }));
  }, []);

  const setAlias = useCallback((value: string) => {
    setAliasState(value);
    setFieldError((previous) => ({
      ...previous,
      alias: null,
    }));
  }, []);

  const setClientNumber = useCallback((value: string) => {
    setClientNumberState(value);
    setFieldError((previous) => ({
      ...previous,
      clientNumber: null,
    }));
  }, []);

  const applyServerError = useCallback((errorCode: string | null) => {
    if (errorCode !== "CLIENT_NUMBER_ALREADY_EXISTS") {
      return;
    }

    setFieldError((previous) => ({
      ...previous,
      clientNumber: "CLIENT_NUMBER_ALREADY_EXISTS",
    }));
  }, []);

  const reset = useCallback((
    nextName: string,
    nextAlias: string | null,
    nextPhone: string,
    nextClientNumber: number,
  ) => {
    setNameState(nextName);
    setAliasState(nextAlias ?? "");
    setPhoneState(nextPhone);
    setClientNumberState(String(nextClientNumber));
    setFieldError({
      name: null,
      alias: null,
      phone: null,
      clientNumber: null,
    });
  }, []);

  const validate = useCallback(() => {
    const trimmedName = name.trim();
    const normalizedPhone = normalizePhone(phone);
    const normalizedClientNumber = normalizeClientNumber(clientNumber);
    const parsedClientNumber = Number(normalizedClientNumber);

    const nextError: EditClientFieldError = {
      name: null,
      alias: null,
      phone: null,
      clientNumber: null,
    };

    if (trimmedName.length < 3) {
      nextError.name = "CLIENT_NAME_TOO_SHORT";
    }
    if (alias.trim().length > 100) {
      nextError.alias = "CLIENT_ALIAS_TOO_LONG";
    }

    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      nextError.phone = "VALIDATION_PHONE_INVALID";
    }

    if (
      !/^\d+$/.test(normalizedClientNumber)
      || !Number.isSafeInteger(parsedClientNumber)
      || parsedClientNumber <= 0
    ) {
      nextError.clientNumber = "CLIENT_NUMBER_INVALID";
    }

    if (nextError.name || nextError.alias || nextError.phone || nextError.clientNumber) {
      setFieldError(nextError);
      return false;
    }

    setFieldError({
      name: null,
      alias: null,
      phone: null,
      clientNumber: null,
    });
    return true;
  }, [alias, clientNumber, name, phone]);

  const getSanitizedPayload = useCallback(() => {
    const parsedClientNumber = Number(normalizeClientNumber(clientNumber));

    return {
      name: name.trim(),
      alias: alias.trim().length > 0 ? alias.trim() : null,
      phone: normalizePhone(phone),
      clientNumber: parsedClientNumber,
    };
  }, [alias, clientNumber, name, phone]);

  return {
    name,
    setName,
    alias,
    setAlias,
    phone,
    setPhone,
    clientNumber,
    setClientNumber,
    fieldError,
    isValid,
    reset,
    applyServerError,
    validate,
    getSanitizedPayload,
  };
}
