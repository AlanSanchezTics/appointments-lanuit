import { useCallback, useMemo, useState } from "react";

export interface UsePasswordVisibilityParams {
  enabled: boolean;
  showLabel?: string;
  hideLabel?: string;
}

export function usePasswordVisibility({
  enabled,
  showLabel = "Show password",
  hideLabel = "Hide password",
}: UsePasswordVisibilityParams) {
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

  const ariaLabel = visible ? hideLabel : showLabel;

  return {
    visible,
    inputType,
    ariaLabel,
    toggleVisibility,
  };
}
