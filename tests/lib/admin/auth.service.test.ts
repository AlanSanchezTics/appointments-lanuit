import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
      update: updateMock,
    },
  },
}));

describe("admin auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_AUTH_PEPPER;
  });

  it("creates and verifies password hash using salt + pepper", async () => {
    process.env.ADMIN_AUTH_PEPPER = "pepper";
    const { createPasswordHash, verifyPasswordHash } = await import(
      "@/lib/admin/auth/service"
    );

    const { hash, salt } = createPasswordHash("supersecurepass");
    expect(hash).toHaveLength(64);
    expect(salt).toHaveLength(32);

    expect(
      verifyPasswordHash({
        password: "supersecurepass",
        passwordSalt: salt,
        passwordHash: hash,
      }),
    ).toBe(true);
  });

  it("authenticates active admin user and updates last_login_at", async () => {
    process.env.ADMIN_AUTH_PEPPER = "pepper";
    const { createPasswordHash, authenticateAdminCredentials } = await import(
      "@/lib/admin/auth/service"
    );
    const { hash, salt } = createPasswordHash("supersecurepass");

    findUniqueMock.mockResolvedValueOnce({
      id: 1,
      username: "admin",
      name: "Admin User",
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
    });
    updateMock.mockResolvedValueOnce({});

    const admin = await authenticateAdminCredentials({
      username: "admin",
      password: "supersecurepass",
    });

    expect(admin).toEqual({
      id: 1,
      username: "admin",
      name: "Admin User",
    });
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it("returns INVALID_CREDENTIALS for unknown users", async () => {
    const { authenticateAdminCredentials } = await import("@/lib/admin/auth/service");

    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      authenticateAdminCredentials({
        username: "admin",
        password: "supersecurepass",
      }),
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("returns ADMIN_USER_INACTIVE for inactive users", async () => {
    process.env.ADMIN_AUTH_PEPPER = "pepper";
    const { createPasswordHash, authenticateAdminCredentials } = await import(
      "@/lib/admin/auth/service"
    );
    const { hash, salt } = createPasswordHash("supersecurepass");

    findUniqueMock.mockResolvedValueOnce({
      id: 2,
      username: "admin",
      passwordHash: hash,
      passwordSalt: salt,
      status: "inactive",
    });

    await expect(
      authenticateAdminCredentials({
        username: "admin",
        password: "supersecurepass",
      }),
    ).rejects.toThrow("ADMIN_USER_INACTIVE");
  });

  it("upserts bootstrap admin user", async () => {
    const { createOrUpdateAdminUser } = await import("@/lib/admin/auth/service");

    upsertMock.mockResolvedValueOnce({
      id: 2,
      username: "admin",
      name: "Admin User",
      status: "active",
    });

    const result = await createOrUpdateAdminUser({
      username: "admin",
      name: "Admin User",
      password: "supersecurepass",
    });

    expect(result).toEqual({
      id: 2,
      username: "admin",
      name: "Admin User",
      status: "active",
    });
    expect(upsertMock).toHaveBeenCalledOnce();
  });
});
