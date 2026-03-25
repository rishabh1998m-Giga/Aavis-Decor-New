/** Mirrors functions/index.js resolveGstRate */

const MAX_CUSTOM_CURTAIN_SIZE = 200;

export function sanitizeCustomCurtainSize(raw: unknown): string {
  if (raw == null || typeof raw !== "string") return "";
  const t = raw.trim().slice(0, MAX_CUSTOM_CURTAIN_SIZE);
  return t
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveGstRate(
  product: { gst_rate?: unknown; category_id?: string | null } | null,
  categorySlugById: Map<string, string>
): number {
  const raw = product?.gst_rate;
  const n = raw != null && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(n)) return n;
  const slug = product?.category_id ? categorySlugById.get(String(product.category_id)) : null;
  if (slug === "pillow-covers" || slug === "table-linens") return 5;
  return 18;
}
