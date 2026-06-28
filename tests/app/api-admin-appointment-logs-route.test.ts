import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import {
  getAdminAppointmentLogs,
  getAdminAppointmentLogsForExport,
} from "@/lib/admin/appointment-logs/service";
import { buildAppointmentLogsPdfDocument, buildAppointmentLogsPdfFilename } from "@/lib/admin/appointment-logs/pdf";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointment-logs/service", () => ({
  getAdminAppointmentLogs: vi.fn(),
  getAdminAppointmentLogsForExport: vi.fn(),
}));

vi.mock("@/lib/admin/appointment-logs/pdf", () => ({
  buildAppointmentLogsPdfDocument: vi.fn(),
  buildAppointmentLogsPdfFilename: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminAppointmentLogsMock = vi.mocked(getAdminAppointmentLogs);
const getAdminAppointmentLogsForExportMock = vi.mocked(getAdminAppointmentLogsForExport);
const buildAppointmentLogsPdfDocumentMock = vi.mocked(buildAppointmentLogsPdfDocument);
const buildAppointmentLogsPdfFilenameMock = vi.mocked(buildAppointmentLogsPdfFilename);

describe("GET /api/admin/appointment-logs", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/appointment-logs/route");
    const response = await GET(new Request("http://localhost/api/admin/appointment-logs"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns filtered JSON results", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "Admin User" } } as never);
    getAdminAppointmentLogsMock.mockResolvedValueOnce({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      },
      filters: {
        client: "",
        actionType: null,
        month: "",
        actionDateFrom: null,
        actionDateTo: null,
      },
    });

    const { GET } = await import("@/app/api/admin/appointment-logs/route");
    const response = await GET(
      new Request("http://localhost/api/admin/appointment-logs?page=1&pageSize=20&month=2026-06"),
    );

    expect(response.status).toBe(200);
    expect(getAdminAppointmentLogsMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      client: "",
      actionType: null,
      month: "2026-06",
      actionDateFrom: null,
      actionDateTo: null,
    });
  });

  it("returns a PDF export for the filtered result set", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "Admin User" } } as never);
    getAdminAppointmentLogsForExportMock.mockResolvedValueOnce({
      totalItems: 1,
      items: [
        {
          id: 1,
          appointmentNumber: 15,
          client: {
            name: "Ana Lopez",
            alias: null,
            phone: "5512345678",
            clientNumber: 1001,
          },
          actionType: "CONFIRMED",
          actionLabel: "Cita confirmada",
          appointmentDateTime: "2026-06-27T10:00:00-06:00",
          actor: {
            type: "ADMIN",
            label: "Admin",
          },
          actionDateTime: "2026-06-27T12:00:00-06:00",
        },
      ],
    });
    buildAppointmentLogsPdfDocumentMock.mockReturnValueOnce(Buffer.from("%PDF-1.4 mock"));
    buildAppointmentLogsPdfFilenameMock.mockReturnValueOnce("appointment-logs-2026-06-27.pdf");

    const { GET } = await import("@/app/api/admin/appointment-logs/route");
    const response = await GET(
      new Request("http://localhost/api/admin/appointment-logs?format=pdf"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("appointment-logs-2026-06-27.pdf");
    expect(getAdminAppointmentLogsForExportMock).toHaveBeenCalledWith({
      client: "",
      actionType: null,
      month: "",
      actionDateFrom: null,
      actionDateTo: null,
    });
  });

  it("returns 422 when the export exceeds the PDF limit", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "Admin User" } } as never);
    getAdminAppointmentLogsForExportMock.mockRejectedValueOnce(
      new Error("EXPORT_LIMIT_EXCEEDED"),
    );

    const { GET } = await import("@/app/api/admin/appointment-logs/route");
    const response = await GET(
      new Request("http://localhost/api/admin/appointment-logs?format=pdf"),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "EXPORT_LIMIT_EXCEEDED",
      error: "EXPORT_LIMIT_EXCEEDED",
    });
  });
});
