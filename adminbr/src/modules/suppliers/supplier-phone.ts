import { normalizePhoneNumber } from "../notifications/phone.js";
export function normalizeConsentPhone(phone: string | null | undefined, country: string | null = "91") {
  if (!phone || !/^\+?[0-9][0-9 ()-]*$/.test(phone.trim())) return null;
  const digits = phone.replace(/\D/g, "");
  const india = /^(?:\+?91|india|in|ind)$/i.test(country || "91");
  const explicit = phone.trim().startsWith("+") || phone.trim().startsWith("00");
  if (india && !explicit && !(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) return null;
  const normalized = normalizePhoneNumber(phone, country);
  return normalized && /^[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}
