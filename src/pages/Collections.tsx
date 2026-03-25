import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiJson, ApiRequestError } from "@/lib/api";
import StoreLayout from "@/components/layout/StoreLayout";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters, { FilterState } from "@/components/products/ProductFilters";
import { mapApiProductToDetails, type ApiProduct, type ProductWithDetails } from "@/hooks/useProducts";
import { ChevronRight } from "lucide-react";
import PageMeta from "@/components/seo/PageMeta";

const Collections = () => {
  const { slug } = useParams<{ slug: string }>();

  const [filters, setFilters] = useState<FilterState>({
    colors: [], sizes: [], fabric: "", priceRange: [0, 50000], sortBy: "newest", inStockOnly: false,
  });

  const { data: collectionData } = useQuery({
    queryKey: ["collection", slug],
    queryFn: async () => {
      if (!slug) return null;
      try {
        return await apiJson<Record<string, unknown> & { id: string }>(
          `/api/collections/by-slug/${encodeURIComponent(slug)}`
        );
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!slug,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["collection-products", collectionData?.id, collectionData?.type],
    queryFn: async (): Promise<ProductWithDetails[]> => {
      if (!collectionData?.id) return [];
      const rows = await apiJson<ApiProduct[]>(
        `/api/collections/${encodeURIComponent(collectionData.id)}/products`
      );
      return rows.map((p) => mapApiProductToDetails(p));
    },
    enabled: !!collectionData,
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
        title={(collectionData as Record<string, unknown>)?.title as string || slug || "Collection"}
        description={(collectionData as Record<string, unknown>)?.description as string || `Shop the ${(collectionData as Record<string, unknown>)?.title || slug} collection at Aavis Decor.`}
        canonical={slug ? `/collections/${slug}` : "/collections"}
      />
      <div className="pt-32 pb-20">
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-xs text-foreground/50">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{(collectionData as Record<string, unknown>)?.title || slug}</span>
          </nav>
        </div>
        <div className="container mb-10">
          <h1 className="font-display text-3xl lg:text-4xl text-foreground mb-3">{(collectionData as Record<string, unknown>)?.title || slug}</h1>
          {(collectionData as Record<string, unknown>)?.description && <p className="text-foreground/60 max-w-2xl">{(collectionData as Record<string, unknown>).description as string}</p>}
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
