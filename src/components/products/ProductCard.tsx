import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ProductWithDetails } from "@/hooks/useProducts";
import { formatPrice } from "@/lib/formatters";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";
import { getColorForSwatch } from "@/lib/colorMap";

interface ProductCardProps {
  product: ProductWithDetails;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { addItem } = useCart();
  
  const primaryImage = product.images.find((img) => img.isPrimary) || product.images[0];
  const hoverImage = product.images.find((img) => !img.isPrimary && img.sortOrder === 1);
  const firstVariant = product.variants[0];
  
  const displayPrice = firstVariant?.price ?? product.basePrice;
  const comparePrice = firstVariant?.compareAtPrice ?? product.compareAtPrice;
  const isOnSale = comparePrice && comparePrice > displayPrice;
  const inStock = firstVariant?.stockQuantity > 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant || !inStock) return;

    addItem({
      productId: product.id,
      productSlug: product.slug,
      variantId: firstVariant.id,
      name: product.name,
      variantInfo: [firstVariant.color, firstVariant.size].filter(Boolean).join(" / ") || "Default",
      price: displayPrice,
      compareAtPrice: comparePrice ?? undefined,
      imageUrl: primaryImage?.url || "/placeholder.svg",
      sku: firstVariant.sku,
      maxStock: firstVariant.stockQuantity,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/product/${product.slug}`} className="group block">
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden bg-muted mb-4">
          {/* Primary Image */}
          <img
            src={primaryImage?.url || "/placeholder.svg"}
            alt={primaryImage?.altText || product.name}
            className={cn(
              "w-full h-full object-contain transition-opacity duration-500",
              hoverImage ? "group-hover:opacity-0" : ""
            )}
            loading="lazy"
          />
          
          {/* Hover Image */}
          {hoverImage && (
            <img
              src={hoverImage.url}
              alt={hoverImage.altText || product.name}
              className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              loading="lazy"
            />
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {isOnSale && (
              <span className="bg-accent text-accent-foreground text-[10px] tracking-widest px-2 py-1">
                SALE
              </span>
            )}
            {!inStock && (
              <span className="bg-foreground/80 text-background text-[10px] tracking-widest px-2 py-1">
                SOLD OUT
              </span>
            )}
          </div>

          {/* Quick Add Button */}
          {inStock && (
            <button
              onClick={handleQuickAdd}
              className="absolute bottom-0 left-0 right-0 bg-foreground/90 text-background text-[10px] tracking-widest py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-foreground"
            >
              QUICK ADD
            </button>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1.5">
          {product.designName && (
            <p className="text-[10px] tracking-widest text-foreground/50 uppercase">
              {product.designName}
            </p>
          )}
          <h3 className="font-display text-base text-foreground group-hover:text-foreground/70 transition-colors line-clamp-2">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">
              {formatPrice(displayPrice)}
            </span>
            {isOnSale && (
              <span className="text-sm text-foreground/40 line-through">
                {formatPrice(comparePrice)}
              </span>
            )}
          </div>
          
          {/* Color swatches preview */}
          {product.variants.length > 1 && (
            <div className="flex gap-1 pt-1">
              {[...new Set(product.variants.map((v) => v.color).filter(Boolean))]
                .slice(0, 4)
                .map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ backgroundColor: getColorForSwatch(color) }}
                    title={color ?? ""}
                  />
                ))}
              {[...new Set(product.variants.map((v) => v.color).filter(Boolean))].length > 4 && (
                <span className="text-[10px] text-foreground/50">
                  +{[...new Set(product.variants.map((v) => v.color).filter(Boolean))].length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
