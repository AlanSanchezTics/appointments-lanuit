import { describe, expect, it, vi } from "vitest";

type MiddlewareRequest = {
  nextUrl: { pathname: string };
  url: string;
  auth: { user: { name: string } } | null;
};

const authMock = vi.fn((handler: (request: MiddlewareRequest) => Response) => handler);

vi.mock("@/auth", () => ({
  auth: authMock,
}));

describe("admin middleware", () => {
  it("redirects unauthenticated users to /admin/login", async () => {
    const middlewareModule = await import("@/middleware");
    const response = middlewareModule.default({
      nextUrl: { pathname: "/admin" },
      url: "http://localhost/admin",
      auth: null,
    } as never);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("redirects authenticated users away from /admin/login", async () => {
    const middlewareModule = await import("@/middleware");
    const response = middlewareModule.default({
      nextUrl: { pathname: "/admin/login" },
      url: "http://localhost/admin/login",
      auth: { user: { name: "admin" } },
    } as never);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });
});
