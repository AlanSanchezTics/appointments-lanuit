import { describe, expect, it, vi } from "vitest";

const aggregateMock = vi.fn();
const createMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      aggregate: aggregateMock,
    },
  },
}));

describe("client number service", () => {
  it("returns next client number suggestion based on current max", async () => {
    aggregateMock.mockResolvedValueOnce({
      _max: {
        clientNumber: 41,
      },
    });

    const { getNextClientNumberSuggestion } = await import(
      "@/lib/clients/client-number-service"
    );

    await expect(getNextClientNumberSuggestion()).resolves.toBe(42);
  });

  it("resolves preferred client number when provided", async () => {
    const { resolveClientNumberForCreate } = await import(
      "@/lib/clients/client-number-service"
    );

    await expect(
      resolveClientNumberForCreate(
        {
          client: {
            aggregate: aggregateMock,
          },
        } as never,
        55,
      ),
    ).resolves.toBe(55);
  });

  it("throws CLIENT_NUMBER_INVALID for non-positive preferred numbers", async () => {
    const { resolveClientNumberForCreate } = await import(
      "@/lib/clients/client-number-service"
    );

    await expect(
      resolveClientNumberForCreate(
        {
          client: {
            aggregate: aggregateMock,
          },
        } as never,
        0,
      ),
    ).rejects.toThrow("CLIENT_NUMBER_INVALID");
  });

  it("retries on duplicated client_number and succeeds with recalculated number", async () => {
    aggregateMock
      .mockResolvedValueOnce({
        _max: {
          clientNumber: 10,
        },
      })
      .mockResolvedValueOnce({
        _max: {
          clientNumber: 11,
        },
      });

    createMock
      .mockRejectedValueOnce({
        code: "P2002",
        meta: {
          target: ["client_number"],
        },
      })
      .mockResolvedValueOnce({
        id: 2,
        clientNumber: 12,
        name: "Ana",
        phone: "5512345678",
      });

    const { createClientWithUniqueClientNumber } = await import(
      "@/lib/clients/client-number-service"
    );

    await expect(
      createClientWithUniqueClientNumber(
        {
          client: {
            aggregate: aggregateMock,
            create: createMock,
          },
        } as never,
        {
          name: "Ana",
          phone: "5512345678",
        },
      ),
    ).resolves.toMatchObject({
      clientNumber: 12,
    });
  });

  it("reuses existing client on duplicated phone when names differ only by trailing spaces", async () => {
    aggregateMock.mockResolvedValueOnce({
      _max: {
        clientNumber: 10,
      },
    });
    createMock.mockRejectedValueOnce({
      code: "P2002",
      meta: {
        target: ["phone"],
      },
    });
    findUniqueMock.mockResolvedValueOnce({
      id: 9,
      clientNumber: 7,
      name: "Ana ",
      phone: "5512345678",
    });

    const { createClientWithUniqueClientNumber } = await import(
      "@/lib/clients/client-number-service"
    );

    await expect(
      createClientWithUniqueClientNumber(
        {
          client: {
            aggregate: aggregateMock,
            create: createMock,
            findUnique: findUniqueMock,
          },
        } as never,
        {
          name: "Ana",
          phone: "5512345678",
        },
      ),
    ).resolves.toMatchObject({
      id: 9,
      phone: "5512345678",
    });
  });
});
