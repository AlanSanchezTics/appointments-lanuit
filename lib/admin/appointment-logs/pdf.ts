import type {
  AdminAppointmentLogsFilters,
  AdminAppointmentLogsItem,
} from "@/lib/admin/appointment-logs/types";
import { formatAppointmentLogDateTime } from "@/lib/admin/appointment-logs/service";

const PDF_HEADER = "%PDF-1.4";
const PDF_FOOTER = "%%EOF";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatFilters(filters: AdminAppointmentLogsFilters) {
  const parts = [
    `client=${filters.client || "all"}`,
    `actionType=${filters.actionType || "all"}`,
    `month=${filters.month || "all"}`,
    `actionDateFrom=${filters.actionDateFrom || "all"}`,
    `actionDateTo=${filters.actionDateTo || "all"}`,
  ];

  return parts.join(" | ");
}

function rowToLine(row: AdminAppointmentLogsItem) {
  const clientParts = [
    row.client.name,
    row.client.alias || "",
    row.client.phone,
    row.client.clientNumber ? `#${row.client.clientNumber}` : "",
  ].filter(Boolean);

  return [
    `#${row.appointmentNumber}`,
    clientParts.join(" - "),
    row.actionLabel,
    row.appointmentDateTime,
    row.actor.label,
    row.actionDateTime,
  ].join(" | ");
}

function buildContentLines(input: {
  title: string;
  generatedAt: string;
  filters: AdminAppointmentLogsFilters;
  items: AdminAppointmentLogsItem[];
}) {
  const lines = [
    input.title,
    `Generated at: ${input.generatedAt}`,
    `Filters: ${formatFilters(input.filters)}`,
    "",
    "No. de cita | Cliente | Accion | Fecha/Hora de cita | Actor | Fecha/Hora de accion",
  ];

  if (input.items.length === 0) {
    lines.push("Sin resultados");
    return lines;
  }

  for (const row of input.items) {
    lines.push(rowToLine(row));
  }

  return lines;
}

export function buildAppointmentLogsPdf(input: {
  title: string;
  generatedAt: string;
  filters: AdminAppointmentLogsFilters;
  items: AdminAppointmentLogsItem[];
}) {
  const lines = buildContentLines(input);
  const lineHeight = 14;
  const pageHeight = 792;
  const pageWidth = 612;
  const topMargin = 40;
  const bottomMargin = 40;
  const usableLinesPerPage = Math.max(1, Math.floor((pageHeight - topMargin - bottomMargin) / lineHeight) - 1);

  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += usableLinesPerPage) {
    pages.push(lines.slice(index, index + usableLinesPerPage));
  }

  const pageObjectIds = pages.map((_, index) => index + 4);
  const contentObjectIds = pages.map((_, index) => index + 4 + pages.length);

  const pageObjects = pages.map((pageLines, pageIndex) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      `1 0 0 1 40 ${pageHeight - topMargin} Tm`,
      ...pageLines.flatMap((line, index) => [
        index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -${lineHeight} Td (${escapePdfText(line)}) Tj`,
      ]),
      "ET",
    ].join("\n");
    const contentObjectId = contentObjectIds[pageIndex];

    return {
      pageObject: [
        "<< /Type /Page",
        `/Parent 2 0 R`,
        `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
        `/Resources << /Font << /F1 3 0 R >> >>`,
        `/Contents ${contentObjectId} 0 R >>`,
      ].join(" "),
      contentObject: `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    };
  });

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [" +
      pageObjectIds.map((id) => `${id} 0 R`).join(" ") +
      `] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pageObjects.map((page) => page.pageObject),
    ...pageObjects.map((page) => page.contentObject),
  ];

  let pdf = `${PDF_HEADER}\n`;
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n${PDF_FOOTER}\n`;

  return Buffer.from(pdf, "latin1");
}

export function buildAppointmentLogsPdfFilename(generatedAt: Date) {
  return `appointment-logs-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

export function buildAppointmentLogsPdfDocument(input: {
  title: string;
  generatedAt: Date;
  filters: AdminAppointmentLogsFilters;
  items: AdminAppointmentLogsItem[];
}) {
  return buildAppointmentLogsPdf({
    title: input.title,
    generatedAt: formatAppointmentLogDateTime(input.generatedAt),
    filters: input.filters,
    items: input.items,
  });
}
