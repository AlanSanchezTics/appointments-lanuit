import { formatLongDate } from "@/lib/datetime/mexico-city";

export function buildWhatsappMessage(input: { name: string; date: string; timeSlot: string }) {
  return `Hola Pau, soy ${input.name}.\nTe agende para el dia ${formatLongDate(input.date)} a las ${input.timeSlot}.\nMuchas gracias.`;
}

export function buildWhatsappUrl(input: { name: string; date: string; timeSlot: string }) {
  const phone = process.env.WHATSAPP_PHONE ?? "";
  const message = encodeURIComponent(buildWhatsappMessage(input));
  return `https://wa.me/${phone}?text=${message}`;
}
