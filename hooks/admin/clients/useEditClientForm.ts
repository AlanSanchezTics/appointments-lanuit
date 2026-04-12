"use client";

import { useCallback, useMemo, useState } from "react";

type EditClientFieldError = {
  name: string | null;
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
  initialPhone: string,
  initialClientNumber: number,
) {
  const [name, setNameState] = useState(initialName);
  const [phone, setPhoneState] = useState(initialPhone);
  const [clientNumber, setClientNumberState] = useState(String(initialClientNumber));
  const [fieldError, setFieldError] = useState<EditClientFieldError>({
    name: null,
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
        && /^[0-9]{10}$/.test(normalizePhone(phone))
        && Number.isSafeInteger(parsedClientNumber)
        && parsedClientNumber > 0
      );
    },
    [name, phone, clientNumber],
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
    nextPhone: string,
    nextClientNumber: number,
  ) => {
    setNameState(nextName);
    setPhoneState(nextPhone);
    setClientNumberState(String(nextClientNumber));
    setFieldError({
      name: null,
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
      phone: null,
      clientNumber: null,
    };

    if (trimmedName.length < 3) {
      nextError.name = "CLIENT_NAME_TOO_SHORT";
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

    if (nextError.name || nextError.phone || nextError.clientNumber) {
      setFieldError(nextError);
      return false;
    }

    setFieldError({
      name: null,
      phone: null,
      clientNumber: null,
    });
    return true;
  }, [name, phone, clientNumber]);

  const getSanitizedPayload = useCallback(() => {
    const parsedClientNumber = Number(normalizeClientNumber(clientNumber));

    return {
      name: name.trim(),
      phone: normalizePhone(phone),
      clientNumber: parsedClientNumber,
    };
  }, [name, phone, clientNumber]);

  return {
    name,
    setName,
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
