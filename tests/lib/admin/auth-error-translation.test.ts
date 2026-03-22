import { describe, expect, it } from "vitest";

import { resolveAdminAuthErrorKey } from "@/lib/admin/auth/error-translation";

describe("resolveAdminAuthErrorKey", () => {
  it("maps known admin auth error codes to translation keys", () => {
    expect(resolveAdminAuthErrorKey("FORM_INCOMPLETE")).toBe("auth.FORM_INCOMPLETE");
    expect(resolveAdminAuthErrorKey("INVALID_CREDENTIALS")).toBe("auth.INVALID_CREDENTIALS");
    expect(resolveAdminAuthErrorKey("ADMIN_USER_INACTIVE")).toBe("auth.ADMIN_USER_INACTIVE");
  });

  it("returns UNKNOWN fallback translation key for unknown/empty values", () => {
    expect(resolveAdminAuthErrorKey("SOMETHING_ELSE")).toBe("auth.UNKNOWN_ERROR");
    expect(resolveAdminAuthErrorKey(undefined)).toBe("auth.UNKNOWN_ERROR");
    expect(resolveAdminAuthErrorKey(null)).toBe("auth.UNKNOWN_ERROR");
  });
});
