export function maskSupplierPhone(phone: string | null | undefined, country: string | null = "91") {
  if (!phone) return "Not configured";
  const digits = phone.replace(/\D/g, "");
  const code = (country || "91").replace(/\D/g, "") || "91";
  // Local Indian numbers and already-normalized international numbers share a
  // country prefix only once. Never expose subscriber digits other than last four.
  const full = digits.length === 10 && code === "91" ? code + digits : digits;
  const prefix = full.startsWith(code) ? `+${code} ` : "+";
  return `${prefix}${"*".repeat(Math.max(0, full.length - (full.startsWith(code) ? code.length : 0) - 4))}${full.slice(-4)}`;
}
