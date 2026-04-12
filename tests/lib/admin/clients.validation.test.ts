import { describe, expect, it } from "vitest";

import {
  parseAdminClientIdParam,
  parseAdminClientsCatalogQuery,
  parseSearchAdminClientsQuery,
  parseUpdateAdminClientPayload,
} from "@/lib/admin/clients/validation";

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

  it("rejects invalid search limit", () => {
    const params = new URLSearchParams({
      query: "ana",
      limit: "0",
    });

    expect(() => parseSearchAdminClientsQuery(params)).toThrow(
      "CLIENT_SEARCH_LIMIT_INVALID",
    );
  });

  it("parses clients catalog query with defaults", () => {
    const params = new URLSearchParams();

    expect(parseAdminClientsCatalogQuery(params)).toEqual({
      query: "",
      status: "ALL",
      sort: "RECENT",
      page: 1,
      pageSize: 20,
    });
  });

  it("parses clients catalog query with explicit filters", () => {
    const params = new URLSearchParams({
      query: "maria",
      status: "with_future_appointments",
      sort: "name_asc",
      page: "2",
      pageSize: "15",
    });

    expect(parseAdminClientsCatalogQuery(params)).toEqual({
      query: "maria",
      status: "WITH_FUTURE_APPOINTMENTS",
      sort: "NAME_ASC",
      page: 2,
      pageSize: 15,
    });
  });

  it("parses clients catalog query with loyal filter", () => {
    const params = new URLSearchParams({
      status: "loyal",
    });

    expect(parseAdminClientsCatalogQuery(params)).toEqual({
      query: "",
      status: "LOYAL",
      sort: "RECENT",
      page: 1,
      pageSize: 20,
    });
  });

  it("parses clients catalog query with sort by appointments", () => {
    const params = new URLSearchParams({
      sort: "appointments_desc",
    });

    expect(parseAdminClientsCatalogQuery(params)).toEqual({
      query: "",
      status: "ALL",
      sort: "APPOINTMENTS_DESC",
      page: 1,
      pageSize: 20,
    });
  });

  it("rejects invalid clients catalog page", () => {
    const params = new URLSearchParams({
      page: "0",
    });

    expect(() => parseAdminClientsCatalogQuery(params)).toThrow(
      "CLIENT_CATALOG_PAGE_INVALID",
    );
  });

  it("rejects invalid clients catalog status", () => {
    const params = new URLSearchParams({
      status: "future",
    });

    expect(() => parseAdminClientsCatalogQuery(params)).toThrow();
  });

  it("parses numeric clientId route param", () => {
    expect(parseAdminClientIdParam("42")).toBe(42);
  });

  it("rejects invalid clientId route param", () => {
    expect(() => parseAdminClientIdParam("client-42")).toThrow("CLIENT_ID_INVALID");
  });

  it("parses update client payload", () => {
    expect(parseUpdateAdminClientPayload({ name: "Ana López" })).toEqual({
      name: "Ana López",
    });
  });

  it("parses update client payload with loyal flag only", () => {
    expect(parseUpdateAdminClientPayload({ isLoyal: true })).toEqual({
      isLoyal: true,
    });
  });

  it("parses update client payload with both fields", () => {
    expect(parseUpdateAdminClientPayload({ name: "Ana López", isLoyal: false })).toEqual({
      name: "Ana López",
      isLoyal: false,
    });
  });

  it("parses update client payload with normalized phone", () => {
    expect(parseUpdateAdminClientPayload({ phone: "322 123 4567" })).toEqual({
      phone: "3221234567",
    });
  });

  it("parses update client payload with client number", () => {
    expect(parseUpdateAdminClientPayload({ clientNumber: 1002 })).toEqual({
      clientNumber: 1002,
    });
  });

  it("rejects update client payload when name is too short", () => {
    expect(() => parseUpdateAdminClientPayload({ name: "An" })).toThrow(
      "CLIENT_NAME_TOO_SHORT",
    );
  });

  it("rejects update client payload when phone is invalid", () => {
    expect(() => parseUpdateAdminClientPayload({ phone: "32212345" })).toThrow(
      "VALIDATION_PHONE_INVALID",
    );
  });

  it("rejects update client payload when client number is invalid", () => {
    expect(() => parseUpdateAdminClientPayload({ clientNumber: 0 })).toThrow(
      "CLIENT_NUMBER_INVALID",
    );
  });

  it("rejects empty update client payload", () => {
    expect(() => parseUpdateAdminClientPayload({})).toThrow("VALIDATION_ERROR");
  });
});
