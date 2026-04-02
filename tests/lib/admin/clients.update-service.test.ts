import { beforeEach, describe, expect, it, vi } from "vitest";

const clientFindUniqueMock = vi.fn();
const clientUpdateMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
      update: clientUpdateMock,
    },
  },
}));

describe("admin client update service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CLIENT_NOT_FOUND for unknown client", async () => {
    const { updateAdminClient } = await import("@/lib/admin/clients/update-service");

    clientFindUniqueMock.mockResolvedValueOnce(null);

    await expect(updateAdminClient(999, { name: "Ana Garcia" })).rejects.toThrow(
      "CLIENT_NOT_FOUND",
    );
  });

  it("updates client name", async () => {
    const { updateAdminClient } = await import("@/lib/admin/clients/update-service");

    clientFindUniqueMock.mockResolvedValueOnce({ id: 5 });
    clientUpdateMock.mockResolvedValueOnce({
      id: 5,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: false,
      updatedAt: new Date("2026-03-21T12:00:00.000Z"),
    });

    const response = await updateAdminClient(5, {
      name: "Ana Garcia",
    });

    expect(clientUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 5,
      },
      data: {
        name: "Ana Garcia",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isLoyal: true,
        updatedAt: true,
      },
    });

    expect(response).toEqual({
      clientId: 5,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: false,
      updatedAt: "2026-03-21T12:00:00.000Z",
    });
  });

  it("updates client loyalty flag without changing name", async () => {
    const { updateAdminClient } = await import("@/lib/admin/clients/update-service");

    clientFindUniqueMock.mockResolvedValueOnce({ id: 8 });
    clientUpdateMock.mockResolvedValueOnce({
      id: 8,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: true,
      updatedAt: new Date("2026-03-21T12:00:00.000Z"),
    });

    const response = await updateAdminClient(8, {
      isLoyal: true,
    });

    expect(clientUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 8,
      },
      data: {
        isLoyal: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isLoyal: true,
        updatedAt: true,
      },
    });

    expect(response).toEqual({
      clientId: 8,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: true,
      updatedAt: "2026-03-21T12:00:00.000Z",
    });
  });

  it("updates client phone", async () => {
    const { updateAdminClient } = await import("@/lib/admin/clients/update-service");

    clientFindUniqueMock.mockResolvedValueOnce({ id: 12 });
    clientUpdateMock.mockResolvedValueOnce({
      id: 12,
      name: "Ana Garcia",
      phone: "3221234567",
      isLoyal: false,
      updatedAt: new Date("2026-03-21T12:00:00.000Z"),
    });

    const response = await updateAdminClient(12, {
      phone: "3221234567",
    });

    expect(clientUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 12,
      },
      data: {
        phone: "3221234567",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isLoyal: true,
        updatedAt: true,
      },
    });

    expect(response).toEqual({
      clientId: 12,
      name: "Ana Garcia",
      phone: "3221234567",
      isLoyal: false,
      updatedAt: "2026-03-21T12:00:00.000Z",
    });
  });

  it("maps unique phone conflict to CLIENT_PHONE_ALREADY_EXISTS", async () => {
    const { updateAdminClient } = await import("@/lib/admin/clients/update-service");

    clientFindUniqueMock.mockResolvedValueOnce({ id: 5 });
    clientUpdateMock.mockRejectedValueOnce({ code: "P2002" });

    await expect(updateAdminClient(5, { phone: "3221234567" })).rejects.toThrow(
      "CLIENT_PHONE_ALREADY_EXISTS",
    );
  });
});
