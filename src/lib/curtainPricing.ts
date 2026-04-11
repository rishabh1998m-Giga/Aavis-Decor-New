/** Curtain size price table (per panel/pair). Prices are GST-inclusive. */
export const CURTAIN_PRICE_TABLE: Array<{ size: number; blackout: number; embroidery: number }> = [
  { size: 5,    blackout: 1649,  embroidery: 2349 },
  { size: 5.5,  blackout: 1799,  embroidery: 2549 },
  { size: 6,    blackout: 1899,  embroidery: 2749 },
  { size: 6.5,  blackout: 1999,  embroidery: 2849 },
  { size: 7,    blackout: 2059,  embroidery: 2949 },
  { size: 7.5,  blackout: 2200,  embroidery: 3199 },
  { size: 8,    blackout: 2300,  embroidery: 3349 },
  { size: 8.5,  blackout: 2400,  embroidery: 3499 },
  { size: 9,    blackout: 2499,  embroidery: 3599 },
  { size: 9.5,  blackout: 2599,  embroidery: 3749 },
  { size: 10,   blackout: 2669,  embroidery: 3859 },
  { size: 10.5, blackout: 2779,  embroidery: 4000 },
  { size: 11,   blackout: 2859,  embroidery: 4159 },
  { size: 11.5, blackout: 2999,  embroidery: 4349 },
  { size: 12,   blackout: 3099,  embroidery: 4549 },
];

/** Extract a numeric ft value from a user-typed string like "7.5 ft", "7.5", "7 feet", "7". */
export function parseSizeFt(input: string): number | null {
  if (!input?.trim()) return null;
  const match = input.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (!Number.isFinite(val) || val <= 0) return null;
  return val;
}

export type CurtainType = "blackout" | "embroidery";

/**
 * Detect curtain type from product tags and name.
 * Returns null if the product is not a recognised blackout or embroidery curtain.
 */
export function getCurtainType(product: {
  name?: string | null;
  tags?: string[] | null;
}): CurtainType | null {
  const searchStr = [
    ...(product.tags ?? []),
    product.name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (searchStr.includes("blackout")) return "blackout";
  if (searchStr.includes("embroidery")) return "embroidery";
  return null;
}

/**
 * Look up price for a given size (ft) and curtain type.
 * Returns exact match price, or the nearest tier's price, or null if out of range.
 */
export function lookupCurtainPrice(
  sizeFt: number,
  type: CurtainType
): { price: number; exactMatch: boolean } | null {
  if (sizeFt < 5 || sizeFt > 12) return null;

  // Exact match
  const exact = CURTAIN_PRICE_TABLE.find((row) => row.size === sizeFt);
  if (exact) return { price: exact[type], exactMatch: true };

  // Nearest tier (round up to next 0.5 step)
  const nearest = CURTAIN_PRICE_TABLE.reduce((prev, curr) =>
    Math.abs(curr.size - sizeFt) < Math.abs(prev.size - sizeFt) ? curr : prev
  );
  return { price: nearest[type], exactMatch: false };
}
