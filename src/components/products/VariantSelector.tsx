import { useMemo } from "react";
import { ProductVariant } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import { getColorForSwatch } from "@/lib/colorMap";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
}

const norm = (s: string | null | undefined) => (s || "").toString().trim().toLowerCase();

/** Normalize size for tolerant matching: punctuation, extra spaces (e.g. "Door - 7 Feet" vs "Door 7 Feet"). */
const normSize = (s: string | null | undefined) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const VariantSelector = ({ variants, selectedVariant, onSelect }: VariantSelectorProps) => {
  /** Dedupe by normalized value so "Light Brown" / "light brown" don't render twice. */
  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of variants) {
      const c = v.color;
      if (!c?.trim()) continue;
      const k = norm(c);
      if (!seen.has(k)) seen.set(k, c.trim());
    }
    return [...seen.values()];
  }, [variants]);

  const sizes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of variants) {
      const s = v.size;
      if (!s?.trim()) continue;
      const k = normSize(s);
      if (!seen.has(k)) seen.set(k, s.trim());
    }
    return [...seen.values()];
  }, [variants]);

  const selectedColor = selectedVariant?.color;
  const selectedSize = selectedVariant?.size;

  // Find variant matching selected options (with tolerant size matching)
  const findVariant = (color?: string, size?: string) => {
    const hasColorFilter = Boolean(color?.trim());
    const hasSizeFilter = Boolean(size?.trim());
    return (
      variants.find((v) => {
        const colorMatch =
          !colors.length || !hasColorFilter || norm(v.color) === norm(color);
        const sizeMatch =
          !sizes.length || !hasSizeFilter || norm(v.size) === norm(size);
        return colorMatch && sizeMatch && v.isActive;
      }) ||
      (hasSizeFilter
        ? variants.find((v) => {
            const colorMatch =
              !colors.length || !hasColorFilter || norm(v.color) === norm(color);
            const sizeMatch =
              !sizes.length || normSize(v.size) === normSize(size);
            return colorMatch && sizeMatch && v.isActive;
          })
        : undefined)
    );
  };

  const handleColorSelect = (color: string) => {
    const variant = findVariant(color, selectedSize) || findVariant(color, undefined);
    if (variant) onSelect(variant);
  };

  const handleSizeSelect = (size: string) => {
    const variant = findVariant(selectedColor, size) || findVariant(undefined, size);
    if (variant) onSelect(variant);
  };

  // Check if a combination is available
  const isColorAvailable = (color: string) => {
    return variants.some(
      (v) => norm(v.color) === norm(color) && v.isActive && v.stockQuantity > 0
    );
  };

  const isSizeAvailable = (size: string) => {
    const sizeNorm = normSize(size);
    return variants.some(
      (v) =>
        (norm(v.size) === norm(size) || normSize(v.size) === sizeNorm) &&
        (!selectedColor || norm(v.color) === norm(selectedColor)) &&
        v.isActive &&
        v.stockQuantity > 0
    );
  };

  if (variants.length <= 1 && !colors.length && !sizes.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Color Selector */}
      {colors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs tracking-widest text-foreground/70">COLOR</span>
            {selectedColor && (
              <span className="text-xs text-foreground">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = isColorAvailable(color);
              const variant = findVariant(color, selectedSize) || findVariant(color, undefined);
              const canSelect = !!variant;
              return (
                <button
                  type="button"
                  key={color}
                  onClick={() => canSelect && handleColorSelect(color)}
                  disabled={!canSelect}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 transition-all relative",
                    norm(selectedColor) === norm(color)
                      ? "border-foreground scale-110"
                      : "border-border/50 hover:border-foreground/50",
                    !available && "opacity-60"
                  )}
                  style={{ backgroundColor: getColorForSwatch(color) }}
                  title={color}
                >
                  {!available && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-full h-0.5 bg-foreground/50 rotate-45 absolute" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs tracking-widest text-foreground/70">SIZE</span>
            <button type="button" className="text-xs text-foreground/50 underline hover:text-foreground">
              Size Guide
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = isSizeAvailable(size);
              const variant = findVariant(selectedColor, size) || findVariant(undefined, size);
              const canSelect = !!variant;
              return (
                <button
                  type="button"
                  key={size}
                  onClick={() => canSelect && handleSizeSelect(size)}
                  disabled={!canSelect}
                  className={cn(
                    "min-w-[60px] px-4 py-2.5 text-xs border transition-colors",
                    norm(selectedSize) === norm(size) || normSize(selectedSize) === normSize(size)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/50 text-foreground/70 hover:border-foreground",
                    !available && "opacity-40 cursor-not-allowed line-through"
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
