const maximum = 999999999999n;
export function sampleChargeCents(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2,"0"));
  return cents <= maximum ? cents : null;
}
export function formatSampleCents(cents) { return `${cents / 100n}.${String(cents % 100n).padStart(2,"0")}`; }
export function sampleTotal(material, courier) {
  const left = sampleChargeCents(material), right = sampleChargeCents(courier);
  return left === null || right === null || left + right > maximum ? null : formatSampleCents(left + right);
}
