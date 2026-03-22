import type { ProductImage, ProductVariant } from "@/hooks/useProducts";

const sortByOrder = (list: ProductImage[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder);

const norm = (s: string | null | undefined) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** True if alt text plausibly describes this color (for untagged images). */
function altMatchesColor(altText: string | null | undefined, color: string | null | undefined): boolean {
  const c = norm(color);
  if (!c || c.length < 2) return false;
  const alt = norm(altText);
  if (!alt) return false;
  if (alt.includes(c)) return true;
  const words = c.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return false;
  return words.every((w) => alt.includes(w));
}

function filterByColorInAlt(images: ProductImage[], color: string | null | undefined): ProductImage[] {
  if (!color?.trim()) return [];
  return images.filter((img) => altMatchesColor(img.altText, color));
}

/**
 * Resolves which images to show for the selected variant.
 * - Never uses another variant's tagged photos as a blanket fallback.
 * - Prefers untagged images whose alt text matches the variant color when possible.
 */
export function resolveDisplayedImages(
  images: ProductImage[],
  selectedVariant: ProductVariant | null
): ProductImage[] {
  if (!images.length) return [];

  const anyVariantTagged = images.some((img) => img.variantId);

  // Legacy: nothing tagged — show full gallery
  if (!anyVariantTagged) {
    return sortByOrder(images);
  }

  if (!selectedVariant) {
    return sortByOrder(images.filter((img) => !img.variantId));
  }

  const forThisVariant = images.filter((img) => img.variantId === selectedVariant.id);
  if (forThisVariant.length > 0) return sortByOrder(forThisVariant);

  const untagged = images.filter((img) => !img.variantId);
  if (untagged.length > 0) {
    const colorMatched = filterByColorInAlt(untagged, selectedVariant.color);
    if (colorMatched.length > 0) return sortByOrder(colorMatched);
    return sortByOrder(untagged);
  }

  return [];
}
