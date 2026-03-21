"use client";

import { useCallback } from "react";
import { getSession, signIn, signOut } from "next-auth/react";

function normalizeAuthError(code?: string | null) {
  if (!code) {
    return "INVALID_CREDENTIALS";
  }

  if (
    code.includes("FORM_INCOMPLETE") ||
    code.includes("INVALID_CREDENTIALS") ||
    code.includes("ADMIN_USER_INACTIVE")
  ) {
    return code;
  }

  if (code === "CredentialsSignin") {
    return "INVALID_CREDENTIALS";
  }

  return "INVALID_CREDENTIALS";
}

export function useAdminAuth() {
  const login = useCallback(async (username: string, password: string) => {
    const response = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/admin",
    });

    if (!response || !response.ok) {
      const authError = normalizeAuthError(response?.error);
      const codeFromUrl = response?.url
        ? new URL(response.url, window.location.origin).searchParams.get("code")
        : null;

      throw new Error(codeFromUrl ?? authError);
    }

    return response;
  }, []);

  const logout = useCallback(async () => {
    await signOut({
      redirect: false,
      callbackUrl: "/admin/login",
    });
  }, []);

  const getCurrentSession = useCallback(async () => {
    return getSession();
  }, []);

  return {
    login,
    logout,
    getCurrentSession,
  };
}
