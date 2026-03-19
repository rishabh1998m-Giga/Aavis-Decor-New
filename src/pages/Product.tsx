import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import StoreLayout from "@/components/layout/StoreLayout";
import ImageGallery from "@/components/products/ImageGallery";
import VariantSelector from "@/components/products/VariantSelector";
import PriceDisplay from "@/components/shared/PriceDisplay";
import PincodeChecker from "@/components/shared/PincodeChecker";
import ProductGrid from "@/components/products/ProductGrid";
import { useProduct, useProducts, ProductVariant } from "@/hooks/useProducts";
import { useCart } from "@/contexts/CartContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Minus, Plus, ShoppingBag, Heart, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageMeta from "@/components/seo/PageMeta";

const Product = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(slug || "");
  const { data: allProducts = [] } = useProducts();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product?.variants.length) {
      const defaultVariant = product.variants.find((v) => v.isActive && v.stockQuantity > 0) || product.variants[0];
      setSelectedVariant(defaultVariant);
      setQuantity(1);
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    const primaryImage = product.images.find((img) => img.isPrimary) || product.images[0];
    addItem({
      productId: product.id,
      productSlug: product.slug,
      variantId: selectedVariant.id,
      name: product.name,
      variantInfo: [selectedVariant.color, selectedVariant.size].filter(Boolean).join(" / ") || "Default",
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice ?? undefined,
      imageUrl: primaryImage?.url || "/placeholder.svg",
      sku: selectedVariant.sku,
      maxStock: selectedVariant.stockQuantity,
    }, quantity);
    toast({ title: "Added to bag", description: `${product.name} has been added to your shopping bag.` });
  };

  const inStock = selectedVariant ? selectedVariant.stockQuantity > 0 : false;
  const maxQuantity = selectedVariant?.stockQuantity || 1;

  const relatedProducts = allProducts
    .filter((p) => p.categoryId === product?.categoryId && p.id !== product?.id)
    .slice(0, 4);

  // When slug looks like a Firestore doc ID (e.g. from old cart link), fetch by id and redirect to canonical slug URL
  useEffect(() => {
    if (isLoading || product || !slug) return;
    const looksLikeId = slug.length >= 15 && slug.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(slug);
    if (!looksLikeId) return;
    let cancelled = false;
    getDoc(doc(db, "products", slug)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data();
      const productSlug = data?.slug;
      if (productSlug && productSlug !== slug) navigate(`/product/${productSlug}`, { replace: true });
    });
    return () => { cancelled = true; };
  }, [slug, isLoading, product, navigate]);

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="pt-32 pb-20 container">
          <div className="grid lg:grid-cols-2 gap-10">
            <Skeleton className="aspect-[3/4]" />
            <div className="space-y-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (error || !product) {
    return (
      <StoreLayout>
        <div className="pt-32 pb-20 container text-center">
          <h1 className="text-2xl font-display mb-4">Product not found</h1>
          <p className="text-foreground/60 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Button asChild><Link to="/">Continue Shopping</Link></Button>
        </div>
      </StoreLayout>
    );
  }

  const primaryImage = product.images.find((img) => img.isPrimary) || product.images[0];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description || "",
    image: primaryImage?.url,
    sku: selectedVariant?.sku,
    offers: {
      "@type": "Offer",
      price: selectedVariant?.price || product.basePrice,
      priceCurrency: "INR",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <StoreLayout>
      <PageMeta
        title={product.name}
        description={product.shortDescription || product.description?.slice(0, 155) || `Buy ${product.name} at Aavis Decor`}
        ogImage={primaryImage?.url}
        ogType="product"
        canonical={`/product/${product.slug}`}
        jsonLd={productJsonLd}
      />
      <div className="pt-32 pb-20">
        {/* Breadcrumb */}
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-xs text-foreground/50">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            {product.category && (
              <>
                <Link to={`/category/${product.category.slug}`} className="hover:text-foreground transition-colors">
                  {product.category.name}
                </Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-foreground">{product.name}</span>
          </nav>
        </div>

        {/* Product Details */}
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
            <ImageGallery images={product.images} productName={product.name} />

            <div className="lg:py-4">
              {product.designName && (
                <p className="text-xs tracking-widest text-foreground/50 uppercase mb-2">{product.designName}</p>
              )}
              <h1 className="font-display text-2xl lg:text-3xl text-foreground mb-4">{product.name}</h1>

              <div className="mb-6">
                <PriceDisplay
                  price={selectedVariant?.price || product.basePrice}
                  compareAtPrice={selectedVariant?.compareAtPrice || product.compareAtPrice}
                  gstRate={product.gstRate}
                  showGSTBreakdown
                  size="lg"
                />
              </div>

              {product.shortDescription && (
                <p className="text-foreground/70 mb-6">{product.shortDescription}</p>
              )}

              {product.variants.length > 0 && (
                <div className="mb-6">
                  <VariantSelector variants={product.variants} selectedVariant={selectedVariant} onSelect={setSelectedVariant} />
                </div>
              )}

              {/* Stock Status with Badge */}
              {selectedVariant && (
                <div className="mb-6">
                  {inStock ? (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      {selectedVariant.stockQuantity <= 5 ? `Only ${selectedVariant.stockQuantity} left` : "In Stock"}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Out of Stock</Badge>
                  )}
                </div>
              )}

              {/* Quantity & Add to Cart */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center border border-border/50">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-muted transition-colors" disabled={quantity <= 1}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))} className="p-3 hover:bg-muted transition-colors" disabled={quantity >= maxQuantity}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button onClick={handleAddToCart} disabled={!inStock} className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  {inStock ? "ADD TO BAG" : "OUT OF STOCK"}
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12">
                  <Heart className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-8">
                <h3 className="text-xs tracking-widest text-foreground/70 mb-3">CHECK DELIVERY</h3>
                <PincodeChecker />
              </div>

              <button className="flex items-center gap-2 text-xs text-foreground/50 hover:text-foreground mb-8">
                <Share2 className="h-4 w-4" /> Share this product
              </button>

              {/* Product Details Accordion */}
              <Accordion type="multiple" defaultValue={["description"]} className="border-t border-border/30">
                <AccordionItem value="description">
                  <AccordionTrigger className="text-xs tracking-widest hover:no-underline">DESCRIPTION</AccordionTrigger>
                  <AccordionContent className="text-foreground/70 text-sm leading-relaxed">
                    {product.description || "No description available."}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="details">
                  <AccordionTrigger className="text-xs tracking-widest hover:no-underline">PRODUCT DETAILS</AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-sm text-foreground/70 space-y-2">
                      {selectedVariant?.sku && <li><span className="text-foreground/50">SKU:</span> {selectedVariant.sku}</li>}
                      {product.fabric && <li><span className="text-foreground/50">Fabric:</span> {product.fabric}</li>}
                      {product.dimensions && <li><span className="text-foreground/50">Dimensions:</span> {product.dimensions}</li>}
                      <li><span className="text-foreground/50">GST:</span> {product.gstRate}% included</li>
                      {product.tags && product.tags.length > 0 && (
                        <li><span className="text-foreground/50">Tags:</span> {product.tags.join(", ")}</li>
                      )}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {product.careInstructions && (
                  <AccordionItem value="care">
                    <AccordionTrigger className="text-xs tracking-widest hover:no-underline">CARE INSTRUCTIONS</AccordionTrigger>
                    <AccordionContent className="text-foreground/70 text-sm leading-relaxed">
                      {product.careInstructions}
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="shipping">
                  <AccordionTrigger className="text-xs tracking-widest hover:no-underline">SHIPPING & RETURNS</AccordionTrigger>
                  <AccordionContent className="text-foreground/70 text-sm space-y-2">
                    <p>Free shipping on orders above ₹999</p>
                    <p>Standard delivery: 5-7 business days</p>
                    <p>Easy 7-day returns for unused items</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="container mt-20">
            <h2 className="font-display text-2xl text-foreground mb-8">You May Also Like</h2>
            <ProductGrid products={relatedProducts} />
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default Product;
