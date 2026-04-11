/** Server-side mirror of frontend curtain pricing logic. */

const CURTAIN_PRICE_TABLE: Array<{ size: number; blackout: number; embroidery: number }> = [
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

export type CurtainType = "blackout" | "embroidery";

function parseSizeFt(input: string): number | null {
  if (!input?.trim()) return null;
  const match = input.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

function detectCurtainType(tags: string[] | null | undefined, name: string | null | undefined): CurtainType | null {
  const str = [...(tags ?? []), name ?? ""].join(" ").toLowerCase();
  if (str.includes("blackout")) return "blackout";
  if (str.includes("embroidery")) return "embroidery";
  return null;
}

function lookupPrice(sizeFt: number, type: CurtainType): number | null {
  if (sizeFt < 5 || sizeFt > 12) return null;
  const exact = CURTAIN_PRICE_TABLE.find((r) => r.size === sizeFt);
  if (exact) return exact[type];
  const nearest = CURTAIN_PRICE_TABLE.reduce((prev, curr) =>
    Math.abs(curr.size - sizeFt) < Math.abs(prev.size - sizeFt) ? curr : prev
  );
  return nearest[type];
}

/**
 * If a curtain product has a customCurtainSize, derive the correct price from the rate table.
 * Returns null if unable to resolve (not a curtain, or unrecognised size).
 */
export function resolveCurtainPrice(
  customCurtainSize: string | null | undefined,
  productTags: string[] | null | undefined,
  productName: string | null | undefined
): number | null {
  if (!customCurtainSize?.trim()) return null;
  const type = detectCurtainType(productTags, productName);
  if (!type) return null;
  const sizeFt = parseSizeFt(customCurtainSize);
  if (sizeFt === null) return null;
  return lookupPrice(sizeFt, type);
}
