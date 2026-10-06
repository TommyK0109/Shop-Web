interface PricedItem {
  quantity: number;
  priceCents: number;
}

export function calculateCartTotal(items: PricedItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}
