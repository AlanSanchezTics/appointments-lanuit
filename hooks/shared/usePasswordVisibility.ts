import { useCallback, useMemo, useState } from "react";

export interface UsePasswordVisibilityParams {
  enabled: boolean;
}

export function usePasswordVisibility({ enabled }: UsePasswordVisibilityParams) {
  const [visible, setVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    if (!enabled) {
      return;
    }

    setVisible((current) => !current);
  }, [enabled]);

  const inputType = useMemo(() => {
    if (!enabled) {
      return "text";
    }

    return visible ? "text" : "password";
  }, [enabled, visible]);

  const ariaLabel = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return {
    visible,
    inputType,
    ariaLabel,
    toggleVisibility,
  };
}
