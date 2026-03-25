export const MAX_CUSTOM_CURTAIN_SIZE_LEN = 200;

/** Stable cart row id: variant only, or variant + custom curtain text (separate lines). */
export function buildCartLineId(variantId: string, customCurtainSize?: string | null): string {
  const c = (customCurtainSize ?? "").trim().slice(0, MAX_CUSTOM_CURTAIN_SIZE_LEN);
  if (!c) return variantId;
  return `${variantId}__custom__${encodeURIComponent(c)}`;
}

export function lineEmbeddedGst(lineTotal: number, gstRate: number): number {
  const rate = Number.isFinite(gstRate) && gstRate >= 0 ? gstRate : 18;
  return Math.round((lineTotal * rate) / (100 + rate));
}
