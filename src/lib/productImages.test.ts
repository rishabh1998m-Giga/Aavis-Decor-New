import { describe, it, expect } from "vitest";
import { resolveDisplayedImages } from "./productImages";
import type { ProductImage, ProductVariant } from "@/hooks/useProducts";

const img = (overrides: Partial<ProductImage> & { id: string }): ProductImage => ({
  id: overrides.id,
  productId: "p1",
  variantId: overrides.variantId ?? null,
  url: "https://example.com/x.jpg",
  altText: overrides.altText ?? null,
  isPrimary: overrides.isPrimary ?? false,
  sortOrder: overrides.sortOrder ?? 0,
});

const variant = (overrides: Partial<ProductVariant> & { id: string; color?: string | null }): ProductVariant => ({
  id: overrides.id,
  productId: "p1",
  sku: "SKU",
  color: overrides.color ?? null,
  size: null,
  price: 100,
  compareAtPrice: null,
  stockQuantity: 1,
  isActive: true,
});

describe("resolveDisplayedImages", () => {
  it("legacy: no variant_id on any image shows all", () => {
    const images = [img({ id: "a" }), img({ id: "b" })];
    const v = variant({ id: "v1", color: "Green" });
    expect(resolveDisplayedImages(images, v)).toHaveLength(2);
  });

  it("does not show other variants tagged photos when selection has none", () => {
    const images = [
      img({ id: "a", variantId: "green-v", altText: "green curtain" }),
      img({ id: "b", variantId: "pink-v", altText: "pink curtain" }),
    ];
    const brown = variant({ id: "brown-v", color: "Light Brown" });
    expect(resolveDisplayedImages(images, brown)).toHaveLength(0);
  });

  it("shows images tagged to selected variant", () => {
    const images = [
      img({ id: "a", variantId: "v1" }),
      img({ id: "b", variantId: "v2" }),
    ];
    const v = variant({ id: "v1", color: "Brown" });
    expect(resolveDisplayedImages(images, v).map((i) => i.id)).toEqual(["a"]);
  });

  it("prefers untagged images whose alt matches color (when catalog uses variant tagging)", () => {
    const images = [
      img({ id: "z", variantId: "other-v", altText: "other" }),
      img({ id: "a", variantId: null, altText: "Light Brown curtain" }),
      img({ id: "b", variantId: null, altText: "Green curtain" }),
    ];
    const v = variant({ id: "v1", color: "Light Brown" });
    const out = resolveDisplayedImages(images, v);
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });
});
