import { ProductVariant } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import { getColorForSwatch } from "@/lib/colorMap";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
}

const VariantSelector = ({ variants, selectedVariant, onSelect }: VariantSelectorProps) => {
  // Extract unique colors and sizes
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];

  const selectedColor = selectedVariant?.color;
  const selectedSize = selectedVariant?.size;

  // Find variant matching selected options
  const findVariant = (color?: string, size?: string) => {
    return variants.find((v) => {
      const colorMatch = !colors.length || v.color === color;
      const sizeMatch = !sizes.length || v.size === size;
      return colorMatch && sizeMatch && v.isActive;
    });
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
      (v) => v.color === color && v.isActive && v.stockQuantity > 0
    );
  };

  const isSizeAvailable = (size: string) => {
    return variants.some(
      (v) =>
        v.size === size &&
        (!selectedColor || v.color === selectedColor) &&
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
              return (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  disabled={!available}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 transition-all relative",
                    selectedColor === color
                      ? "border-foreground scale-110"
                      : "border-border/50 hover:border-foreground/50",
                    !available && "opacity-40 cursor-not-allowed"
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
            <button className="text-xs text-foreground/50 underline hover:text-foreground">
              Size Guide
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = isSizeAvailable(size);
              return (
                <button
                  key={size}
                  onClick={() => handleSizeSelect(size)}
                  disabled={!available}
                  className={cn(
                    "min-w-[60px] px-4 py-2.5 text-xs border transition-colors",
                    selectedSize === size
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
