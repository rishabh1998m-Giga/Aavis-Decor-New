import { useState, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StoreLayout from "@/components/layout/StoreLayout";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters, { FilterState } from "@/components/products/ProductFilters";
import { ProductWithDetails } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import PageMeta from "@/components/seo/PageMeta";

const PAGE_SIZE = 20;

const Collections = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || "1");

  const [filters, setFilters] = useState<FilterState>({
    colors: [], sizes: [], fabric: "", priceRange: [0, 50000], sortBy: "newest", inStockOnly: false,
  });

  // Fetch collection
  const { data: collection } = useQuery({
    queryKey: ["collection", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch products for this collection
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["collection-products", collection?.id, collection?.type],
    queryFn: async () => {
      if (!collection) return [];

      if (collection.type === "manual") {
        const { data: cpData } = await supabase
          .from("collection_products")
          .select("product_id")
          .eq("collection_id", collection.id)
          .order("sort_order");

        if (!cpData?.length) return [];

        const productIds = cpData.map((cp: any) => cp.product_id);
        const { data } = await supabase
          .from("products")
          .select(`*, product_variants(id, product_id, sku, color, size, price, compare_at_price, stock_quantity, is_active), product_images(id, product_id, variant_id, url, alt_text, is_primary, sort_order)`)
          .in("id", productIds)
          .eq("is_active", true);

        return (data || []).map((p: any) => ({
          id: p.id, name: p.name, slug: p.slug, description: p.description,
          shortDescription: p.short_description, basePrice: Number(p.base_price),
          compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
          gstRate: Number(p.gst_rate ?? 18), categoryId: p.category_id,
          isActive: true, isFeatured: p.is_featured ?? false,
          designName: p.design_name, tags: p.tags,
          fabric: p.fabric, dimensions: p.dimensions, careInstructions: p.care_instructions,
          createdAt: p.created_at ?? "", category: null,
          variants: (p.product_variants || []).map((v: any) => ({
            id: v.id, productId: v.product_id, sku: v.sku, color: v.color, size: v.size,
            price: Number(v.price), compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
            stockQuantity: v.stock_quantity ?? 0, isActive: v.is_active ?? true,
          })),
          images: (p.product_images || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((img: any) => ({
            id: img.id, productId: img.product_id, variantId: img.variant_id, url: img.url,
            altText: img.alt_text, isPrimary: img.is_primary ?? false, sortOrder: img.sort_order ?? 0,
          })),
        })) as ProductWithDetails[];
      }

      // Automatic: tag-based
      if (collection.type === "automatic" && collection.rules) {
        const rules = collection.rules as any;
        const tags = rules.tags || [];
        if (tags.length === 0) return [];

        const { data } = await supabase
          .from("products")
          .select(`*, product_variants(id, product_id, sku, color, size, price, compare_at_price, stock_quantity, is_active), product_images(id, product_id, variant_id, url, alt_text, is_primary, sort_order)`)
          .eq("is_active", true)
          .overlaps("tags", tags);

        return (data || []).map((p: any) => ({
          id: p.id, name: p.name, slug: p.slug, description: p.description,
          shortDescription: p.short_description, basePrice: Number(p.base_price),
          compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
          gstRate: Number(p.gst_rate ?? 18), categoryId: p.category_id,
          isActive: true, isFeatured: p.is_featured ?? false,
          designName: p.design_name, tags: p.tags,
          fabric: p.fabric, dimensions: p.dimensions, careInstructions: p.care_instructions,
          createdAt: p.created_at ?? "", category: null,
          variants: (p.product_variants || []).map((v: any) => ({
            id: v.id, productId: v.product_id, sku: v.sku, color: v.color, size: v.size,
            price: Number(v.price), compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
            stockQuantity: v.stock_quantity ?? 0, isActive: v.is_active ?? true,
          })),
          images: (p.product_images || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((img: any) => ({
            id: img.id, productId: img.product_id, variantId: img.variant_id, url: img.url,
            altText: img.alt_text, isPrimary: img.is_primary ?? false, sortOrder: img.sort_order ?? 0,
          })),
        })) as ProductWithDetails[];
      }

      return [];
    },
    enabled: !!collection,
  });

  const availableColors = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => { if (v.color) s.add(v.color); }));
    return Array.from(s);
  }, [products]);

  const availableSizes = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => { if (v.size) s.add(v.size); }));
    return Array.from(s);
  }, [products]);

  const availableFabrics = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => { if (p.fabric) s.add(p.fabric); });
    return Array.from(s);
  }, [products]);

  return (
    <StoreLayout>
      <PageMeta
        title={collection?.title || slug || "Collection"}
        description={collection?.description || `Shop the ${collection?.title || slug} collection at Aavis Decor.`}
      />
      <div className="pt-32 pb-20">
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-xs text-foreground/50">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{collection?.title || slug}</span>
          </nav>
        </div>
        <div className="container mb-10">
          <h1 className="font-display text-3xl lg:text-4xl text-foreground mb-3">{collection?.title || slug}</h1>
          {collection?.description && <p className="text-foreground/60 max-w-2xl">{collection.description}</p>}
        </div>
        <div className="container">
          <div className="flex gap-10">
            <ProductFilters
              filters={filters} onFiltersChange={setFilters}
              availableColors={availableColors} availableSizes={availableSizes}
              availableFabrics={availableFabrics} maxPrice={50000} totalProducts={products.length}
            />
            <div className="flex-1">
              <ProductGrid products={products} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default Collections;
