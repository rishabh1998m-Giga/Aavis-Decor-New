/** Categories that use 5% GST when product has no explicit gst_rate in Firestore. */
const GST_5_CATEGORY_SLUGS = new Set(["pillow-covers", "table-linens"]);

export function resolveProductGstRate(
  gstRateRaw: unknown,
  categorySlug: string | null | undefined
): number {
  const n =
    gstRateRaw !== undefined && gstRateRaw !== null && gstRateRaw !== ""
      ? Number(gstRateRaw)
      : NaN;
  if (Number.isFinite(n)) return n;
  if (categorySlug && GST_5_CATEGORY_SLUGS.has(categorySlug)) return 5;
  return 18;
}
