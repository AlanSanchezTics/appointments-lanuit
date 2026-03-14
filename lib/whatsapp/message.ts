import { formatLongDate, formatTimeSlotLabel } from "@/lib/datetime/mexico-city";

export function buildWhatsappMessage(input: { name: string; date: string; timeSlot: string }) {
  const appUrl = getAppUrl();

  return `Hola Pau ✨\nsoy ${input.name} ✌️.\nYa te agendé para el día ${formatLongDate(input.date)} a las ${formatTimeSlotLabel(input.timeSlot)}.\nMuchas gracias y bonito día 😊\n\n(Para cancelar tu cita accede a ${appUrl}/cancelar)`;
}

export function buildWhatsappUrl(input: { name: string; date: string; timeSlot: string }) {
  const phone = process.env.WHATSAPP_PHONE ?? "";
  const message = encodeURIComponent(buildWhatsappMessage(input));
  return `https://wa.me/${phone}?text=${message}`;
}

function getAppUrl() {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return appUrl.replace(/\/$/, "");
}
