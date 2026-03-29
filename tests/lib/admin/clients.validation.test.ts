import { describe, expect, it } from "vitest";

import { parseSearchAdminClientsQuery } from "@/lib/admin/clients/validation";

describe("admin clients validation", () => {
  it("parses search query with default limit", () => {
    const params = new URLSearchParams({
      query: "ana",
    });

    expect(parseSearchAdminClientsQuery(params)).toEqual({
      query: "ana",
      limit: 8,
    });
  });

  it("parses search query with explicit limit", () => {
    const params = new URLSearchParams({
      query: "ana",
      limit: "5",
    });

    expect(parseSearchAdminClientsQuery(params)).toEqual({
      query: "ana",
      limit: 5,
    });
  });

  it("rejects invalid limit", () => {
    const params = new URLSearchParams({
      query: "ana",
      limit: "0",
    });

    expect(() => parseSearchAdminClientsQuery(params)).toThrow(
      "CLIENT_SEARCH_LIMIT_INVALID",
    );
  });
});
