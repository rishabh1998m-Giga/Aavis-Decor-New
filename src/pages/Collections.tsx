import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, orderBy, doc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import StoreLayout from "@/components/layout/StoreLayout";
import ProductGrid from "@/components/products/ProductGrid";
import ProductFilters, { FilterState } from "@/components/products/ProductFilters";
import { ProductWithDetails } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
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
      const q = query(
        collection(db, "collections"),
        where("slug", "==", slug!),
        where("is_active", "==", true)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    },
    enabled: !!slug,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["collection-products", collectionData?.id, collectionData?.type],
    queryFn: async () => {
      if (!collectionData) return [];

      if (collectionData.type === "manual") {
        const cpSnap = await getDocs(
          query(
            collection(db, "collection_products"),
            where("collection_id", "==", collectionData.id),
            orderBy("sort_order")
          )
        );
        if (cpSnap.empty) return [];
        const productIds = cpSnap.docs.map((d) => d.data().product_id);
        if (productIds.length === 0) return [];
        const batches = [];
        for (let i = 0; i < productIds.length; i += 10) {
          batches.push(productIds.slice(i, i + 10));
        }
        const allProducts: ProductWithDetails[] = [];
        const categoriesSnap = await getDocs(query(collection(db, "categories"), where("is_active", "==", true)));
        const categoriesMap = new Map(categoriesSnap.docs.map((d) => [d.id, { id: d.id, name: d.data().name, slug: d.data().slug, description: d.data().description, image_url: d.data().image_url, is_active: d.data().is_active, sort_order: d.data().sort_order }]));

        for (const idBatch of batches) {
          const refs = idBatch.map((id) => doc(db, "products", id));
          const [productsSnap, variantsSnap, imagesSnap] = await Promise.all([
            getDocs(query(collection(db, "products"), where("__name__", "in", refs))),
            getDocs(query(collection(db, "product_variants"), where("product_id", "in", idBatch), where("is_active", "==", true))),
            getDocs(query(collection(db, "product_images"), where("product_id", "in", idBatch))),
          ]);
          const variants = variantsSnap.docs.map((d) => {
            const v = d.data();
            return {
              id: d.id, productId: v.product_id, sku: v.sku, color: v.color ?? null, size: v.size ?? null,
              price: Number(v.price), compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
              stockQuantity: v.stock_quantity ?? 0, isActive: true,
            };
          });
          const images = imagesSnap.docs.map((d) => {
            const img = d.data();
            return {
              id: d.id, productId: img.product_id, variantId: img.variant_id ?? null, url: img.url,
              altText: img.alt_text ?? null, isPrimary: img.is_primary ?? false, sortOrder: img.sort_order ?? 0,
            };
          });
          const orderMap = new Map(productIds.map((id, i) => [id, i]));
          const batchProducts = productsSnap.docs
            .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
            .map((d) => {
              const p = d.data();
              const cat = p.category_id && categoriesMap.get(p.category_id);
              return {
                id: d.id, name: p.name, slug: p.slug, description: p.description ?? null,
                shortDescription: p.short_description ?? null, basePrice: Number(p.base_price),
                compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
                gstRate: Number(p.gst_rate ?? 18), categoryId: p.category_id ?? null,
                isActive: true, isFeatured: p.is_featured ?? false, designName: p.design_name ?? null,
                tags: p.tags ?? null, fabric: p.fabric ?? null, dimensions: p.dimensions ?? null,
                careInstructions: p.care_instructions ?? null, createdAt: p.created_at ?? "",
                category: cat ? { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description ?? null, imageUrl: cat.image_url ?? null, isActive: cat.is_active ?? true, sortOrder: cat.sort_order ?? 0 } : null,
                variants: variants.filter((v) => v.productId === d.id),
                images: images.filter((img) => img.productId === d.id).sort((a, b) => a.sortOrder - b.sortOrder),
              } as ProductWithDetails;
            });
          allProducts.push(...batchProducts);
        }
        return allProducts;
      }

      if (collectionData.type === "automatic" && collectionData.rules) {
        const rules = collectionData.rules as { tags?: string[] };
        const tags = rules.tags || [];
        if (tags.length === 0) return [];
        const productsSnap = await getDocs(
          query(
            collection(db, "products"),
            where("is_active", "==", true),
            where("tags", "array-contains-any", tags.slice(0, 10))
          )
        );
        const productIds = productsSnap.docs.map((d) => d.id).slice(0, 30);
        if (productIds.length === 0) return [];
        const [variantsSnap, imagesSnap, categoriesSnap] = await Promise.all([
          getDocs(query(collection(db, "product_variants"), where("product_id", "in", productIds), where("is_active", "==", true))),
          getDocs(query(collection(db, "product_images"), where("product_id", "in", productIds))),
          getDocs(query(collection(db, "categories"), where("is_active", "==", true))),
        ]);
        const categoriesMap = new Map(categoriesSnap.docs.map((d) => [d.id, d.data()]));
        const variants = variantsSnap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id, productId: v.product_id, sku: v.sku, color: v.color ?? null, size: v.size ?? null,
            price: Number(v.price), compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
            stockQuantity: v.stock_quantity ?? 0, isActive: true,
          };
        });
        const images = imagesSnap.docs.map((d) => {
          const img = d.data();
          return {
            id: d.id, productId: img.product_id, variantId: img.variant_id ?? null, url: img.url,
            altText: img.alt_text ?? null, isPrimary: img.is_primary ?? false, sortOrder: img.sort_order ?? 0,
          };
        });
        return productsSnap.docs.map((d) => {
          const p = d.data();
          return {
            id: d.id, name: p.name, slug: p.slug, description: p.description ?? null,
            shortDescription: p.short_description ?? null, basePrice: Number(p.base_price),
            compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
            gstRate: Number(p.gst_rate ?? 18), categoryId: p.category_id ?? null,
            isActive: true, isFeatured: p.is_featured ?? false, designName: p.design_name ?? null,
            tags: p.tags ?? null, fabric: p.fabric ?? null, dimensions: p.dimensions ?? null,
            careInstructions: p.care_instructions ?? null, createdAt: p.created_at ?? "",
            category: p.category_id && categoriesMap.has(p.category_id) ? { id: p.category_id, name: (categoriesMap.get(p.category_id) as any).name, slug: (categoriesMap.get(p.category_id) as any).slug, description: null, imageUrl: null, isActive: true, sortOrder: 0 } : null,
            variants: variants.filter((v) => v.productId === d.id),
            images: images.filter((img) => img.productId === d.id).sort((a, b) => a.sortOrder - b.sortOrder),
          } as ProductWithDetails;
        });
      }

      return [];
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
