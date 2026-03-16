export function getWhatsappPhone() {
  return process.env.WHATSAPP_PHONE ?? "";
}

export function getAppUrl() {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return appUrl.replace(/\/$/, "");
}

export function buildWhatsappUrlFromMessage(input: { phone: string; message: string }) {
  const message = encodeURIComponent(input.message);
  return `https://wa.me/${input.phone}?text=${message}`;
}
