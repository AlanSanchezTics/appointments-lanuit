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
        updatedAt: true,
      },
    });

    expect(response).toEqual({
      clientId: 5,
      name: "Ana Garcia",
      phone: "5512345678",
      updatedAt: "2026-03-21T12:00:00.000Z",
    });
  });
});
