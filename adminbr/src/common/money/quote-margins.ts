export function quoteMargins(supplierPrice: number, finalPrice: number, quantity = 0) {
  if (![supplierPrice, finalPrice, quantity].every(Number.isFinite) || supplierPrice <= 0 || finalPrice <= 0 || quantity < 0) return null;
  const profitPerMeter = finalPrice - supplierPrice;
  return { profitPerMeter, marginPercent: profitPerMeter / finalPrice * 100, markupPercent: profitPerMeter / supplierPrice * 100,
    estimatedGrossProfit: profitPerMeter * quantity };
}
