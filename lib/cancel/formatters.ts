export function formatPhoneForDisplay(phone: string) {
  const trimmed = phone.replace(/\D/g, "");

  if (trimmed.length !== 10) {
    return phone;
  }

  return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
}

