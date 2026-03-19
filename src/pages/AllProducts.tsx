import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StoreLayout from "@/components/layout/StoreLayout";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters, { FilterState } from "@/components/products/ProductFilters";
import { usePaginatedProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import PageMeta from "@/components/seo/PageMeta";

const PAGE_SIZE = 20;

const AllProducts = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || "1");

  const [filters, setFilters] = useState<FilterState>({
    colors: [],
    sizes: [],
    fabric: "",
    priceRange: [0, 50000],
    sortBy: "newest",
    inStockOnly: false,
  });

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("page", "1");
      return p;
    });
  };

  const { data, isLoading } = usePaginatedProducts({
    page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy,
    colors: filters.colors.length > 0 ? filters.colors : undefined,
    sizes: filters.sizes.length > 0 ? filters.sizes : undefined,
    fabric: filters.fabric || undefined,
    priceMin: filters.priceRange[0] > 0 ? filters.priceRange[0] : undefined,
    priceMax: filters.priceRange[1] < 50000 ? filters.priceRange[1] : undefined,
    inStockOnly: filters.inStockOnly || undefined,
  });

  const products = data?.products || [];
  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;

  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => { if (v.color) colors.add(v.color); }));
    return Array.from(colors);
  }, [products]);

  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => { if (v.size) sizes.add(v.size); }));
    return Array.from(sizes);
  }, [products]);

  const availableFabrics = useMemo(() => {
    const fabrics = new Set<string>();
    products.forEach((p) => { if (p.fabric) fabrics.add(p.fabric); });
    return Array.from(fabrics);
  }, [products]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  return (
    <StoreLayout>
      <PageMeta
        title="All Products"
        description="Shop all premium handcrafted pillow covers, curtains, table linens and home textiles at Aavis Decor."
        canonical="/collections"
      />
      <div className="pt-32 pb-20">
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-xs text-foreground/50">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">All Products</span>
          </nav>
        </div>
        <div className="container mb-10">
          <h1 className="font-display text-3xl lg:text-4xl text-foreground mb-3">All Products</h1>
          <p className="text-foreground/60 max-w-2xl">Handpicked home textiles — pillow covers, curtains, table linens and more.</p>
        </div>
        <div className="container">
          <div className="flex gap-10">
            <ProductFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableColors={availableColors}
              availableSizes={availableSizes}
              availableFabrics={availableFabrics}
              maxPrice={50000}
              totalProducts={totalCount}
            />
            <div className="flex-1">
              <ProductGrid products={products} isLoading={isLoading} />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) pageNum = i + 1;
                    else if (page <= 4) pageNum = i + 1;
                    else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                    else pageNum = page - 3 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default AllProducts;
