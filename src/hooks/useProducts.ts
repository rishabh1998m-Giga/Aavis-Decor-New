import { useQuery } from "@tanstack/react-query";
import { resolveProductGstRate } from "@/lib/gstRate";
import catalog from "@/generated/catalog.json";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  gstRate: number;
  categoryId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  designName: string | null;
  tags: string[] | null;
  fabric: string | null;
  dimensions: string | null;
  careInstructions: string | null;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ProductWithDetails extends Product {
  variants: ProductVariant[];
  images: ProductImage[];
  category: Category | null;
}

type ApiCategory = {
  id: string;
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

type ApiVariant = {
  id: string;
  product_id: string;
  sku: string;
  color?: string | null;
  size?: string | null;
  price: number;
  compare_at_price?: number | null;
  stock_quantity?: number;
  is_active?: boolean;
};

type ApiImage = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  url: string;
  alt_text?: string | null;
  is_primary?: boolean;
  sort_order?: number;
};

export type ApiProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  base_price: number;
  max_variant_price?: number | null;
  compare_at_price?: number | null;
  gst_rate?: number | null;
  category_id?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  design_name?: string | null;
  tags?: string[] | null;
  fabric?: string | null;
  dimensions?: string | null;
  care_instructions?: string | null;
  created_at?: string;
  category?: ApiCategory | null;
  variants?: ApiVariant[];
  images?: ApiImage[];
};

function mapCategoryFromApi(c: ApiCategory | null | undefined): Category | null {
  if (!c?.id) return null;
  return {
    id: c.id,
    name: c.name ?? "",
    slug: c.slug ?? "",
    description: c.description ?? null,
    imageUrl: c.image_url ?? null,
    isActive: c.is_active ?? true,
    sortOrder: c.sort_order ?? 0,
  };
}

export function mapApiProductToDetails(
  p: ApiProduct,
  categoriesFallback?: Map<string, Category>
): ProductWithDetails {
  const cat =
    mapCategoryFromApi(p.category) ??
    (p.category_id && categoriesFallback?.get(p.category_id)) ??
    null;
  const variants: ProductVariant[] = (p.variants ?? []).map((v) => ({
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    color: v.color ?? null,
    size: v.size ?? null,
    price: Number(v.price),
    compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
    stockQuantity: v.stock_quantity ?? 0,
    isActive: v.is_active ?? true,
  }));
  const images: ProductImage[] = (p.images ?? [])
    .map((img) => ({
      id: img.id,
      productId: img.product_id,
      variantId: img.variant_id ?? null,
      url: img.url,
      altText: img.alt_text ?? null,
      isPrimary: img.is_primary ?? false,
      sortOrder: img.sort_order ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    shortDescription: p.short_description ?? null,
    basePrice: Number(p.base_price ?? 0),
    compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    gstRate: resolveProductGstRate(p.gst_rate, cat?.slug),
    categoryId: p.category_id ?? null,
    isActive: p.is_active ?? true,
    isFeatured: p.is_featured ?? false,
    designName: p.design_name ?? null,
    tags: p.tags ?? null,
    fabric: p.fabric ?? null,
    dimensions: p.dimensions ?? null,
    careInstructions: p.care_instructions ?? null,
    createdAt: p.created_at ?? "",
    category: cat,
    variants: variants.filter((v) => v.productId === p.id).sort((a, b) => a.sku.localeCompare(b.sku)),
    images,
  };
}

export interface PaginatedProductsParams {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  sortBy?: string;
  colors?: string[];
  sizes?: string[];
  fabric?: string;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
}

export interface PaginatedResult {
  products: ProductWithDetails[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

const normalizeSlug = (value?: string) =>
  decodeURIComponent(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      return (catalog.categories as ApiCategory[]).map((c) => mapCategoryFromApi(c)!);
    },
  });
};

export const useCategoryImages = (categories: Category[]) => {
  // Static mode: compute representative images locally for any categories
  // that have `imageUrl` missing in `catalog.json`.
  const needImage = categories.filter((c) => !c.imageUrl);
  return useQuery({
    queryKey: ["category-images", needImage.map((c) => c.id)],
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      if (needImage.length === 0) return map;

      const rawProducts = catalog.products as ApiProduct[];

      for (const cat of needImage) {
        const p = rawProducts
          .filter((rp) => rp.is_active !== false && rp.category_id === cat.id)
          .sort((a, b) => Date.parse(String(b.created_at ?? "")) - Date.parse(String(a.created_at ?? "")))[0];
        const primary =
          p?.images?.find((img) => img.is_primary) ||
          (p?.images ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
        if (primary?.url) map.set(cat.id, primary.url);
      }

      return map;
    },
    enabled: needImage.length > 0,
  });
};

export const usePaginatedProducts = (params: PaginatedProductsParams = {}) => {
  const {
    page = 1,
    pageSize = 20,
    categorySlug,
    sortBy = "newest",
    colors,
    sizes,
    fabric,
    priceMin,
    priceMax,
    inStockOnly,
  } = params;

  return useQuery({
    queryKey: [
      "products-paginated",
      page,
      pageSize,
      categorySlug,
      sortBy,
      colors,
      sizes,
      fabric,
      priceMin,
      priceMax,
      inStockOnly,
    ],
    queryFn: async (): Promise<PaginatedResult> => {
      const rawProducts = catalog.products as ApiProduct[];
      const rawCategories = catalog.categories as ApiCategory[];

      // Build categories map once for consistent gst + breadcrumb logic.
      const categoriesMap = new Map<string, Category>();
      rawCategories.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });

      let categoryId: string | null = null;
      const normalizedCategorySlug = normalizeSlug(categorySlug);
      if (normalizedCategorySlug) {
        const match = rawCategories.find(
          (c) => normalizeSlug(c.slug ?? "") === normalizedCategorySlug
        );
        if (!match) {
          return { products: [], totalCount: 0, totalPages: 0, currentPage: page };
        }
        categoryId = match.id;
      }

      const activeProducts = rawProducts.filter((p) => p.is_active !== false);

      const hasPriceFilter = priceMin != null || priceMax != null;
      const hasPriceMin = priceMin != null && priceMin > 0;

      // Base filtering mirrors server-side whereClause (colors/sizes/inStock are applied after slicing).
      const baseFiltered = activeProducts.filter((p) => {
        if (categoryId && p.category_id !== categoryId) return false;
        if (fabric && (p.fabric ?? null) !== fabric) return false;
        if (hasPriceMin) {
          const maxVariant = Number(p.max_variant_price ?? 0);
          if (!(maxVariant >= (priceMin as number))) return false;
        }
        if (priceMax != null && priceMax > 0) {
          const base = Number(p.base_price ?? 0);
          if (!(base <= priceMax)) return false;
        }
        return true;
      });

      const totalCount = baseFiltered.length;

      const orderParts = (() => {
        if (hasPriceMin) return "priceMin";
        if (sortBy === "price-high") return "priceHigh";
        if (sortBy === "price-low" || hasPriceFilter) return "priceLowOrFilter";
        if (sortBy === "name") return "name";
        return "newest";
      })();

      baseFiltered.sort((a, b) => {
        const aCreated = Date.parse(String(a.created_at ?? 0));
        const bCreated = Date.parse(String(b.created_at ?? 0));
        const aBase = Number(a.base_price ?? 0);
        const bBase = Number(b.base_price ?? 0);
        const aMax = Number(a.max_variant_price ?? 0);
        const bMax = Number(b.max_variant_price ?? 0);

        switch (orderParts) {
          case "priceMin": {
            // [asc(max_variant_price), desc(createdAt)]
            if (aMax !== bMax) return aMax - bMax;
            return bCreated - aCreated;
          }
          case "priceHigh":
            return bBase - aBase;
          case "priceLowOrFilter":
            return aBase - bBase;
          case "name":
            return String(a.name ?? "").localeCompare(String(b.name ?? ""));
          case "newest":
          default:
            return bCreated - aCreated;
        }
      });

      const offset = (page - 1) * pageSize;
      const sliced = baseFiltered.slice(offset, offset + pageSize);

      // Post-filter: mirrors server behavior for colors/sizes/inStockOnly.
      let products = sliced.map((p) => mapApiProductToDetails(p, categoriesMap));

      if (colors?.length) {
        products = products.filter((p) =>
          p.variants.some((v) => v.color && colors.includes(v.color))
        );
      }
      if (sizes?.length) {
        products = products.filter((p) =>
          p.variants.some((v) => v.size && sizes.includes(v.size))
        );
      }
      if (inStockOnly) {
        products = products.filter((p) =>
          p.variants.some((v) => v.stockQuantity > 0)
        );
      }

      return {
        products,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      };
    },
  });
};

export const useProducts = (categorySlug?: string) => {
  return useQuery({
    queryKey: ["products", categorySlug],
    queryFn: async () => {
      const rawProducts = catalog.products as ApiProduct[];
      const rawCategories = catalog.categories as ApiCategory[];

      const categoriesMap = new Map<string, Category>();
      rawCategories.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });

      let categoryId: string | null = null;
      const normalizedCategorySlug = normalizeSlug(categorySlug);
      if (normalizedCategorySlug) {
        const match = rawCategories.find(
          (c) => normalizeSlug(c.slug ?? "") === normalizedCategorySlug
        );
        if (match) categoryId = match.id;
        else categoryId = null;
      }

      const filtered = rawProducts
        .filter((p) => p.is_active !== false)
        .filter((p) => (categoryId ? p.category_id === categoryId : true))
        .sort((a, b) => Date.parse(String(b.created_at ?? 0)) - Date.parse(String(a.created_at ?? 0)))
        .slice(0, 50);

      return filtered.map((p) => mapApiProductToDetails(p, categoriesMap));
    },
  });
};

export const useProduct = (slug: string) => {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const rawProducts = catalog.products as ApiProduct[];
      const row = rawProducts.find((p) => p.is_active !== false && p.slug === slug);
      if (!row) throw new Error("Product not found");

      const rawCategories = catalog.categories as ApiCategory[];
      const categoriesMap = new Map<string, Category>();
      rawCategories.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });

      return mapApiProductToDetails(row, categoriesMap);
    },
    enabled: !!slug,
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const rawProducts = catalog.products as ApiProduct[];
      const rawCategories = catalog.categories as ApiCategory[];

      const categoriesMap = new Map<string, Category>();
      rawCategories.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });

      return rawProducts
        .filter((p) => p.is_active !== false && p.is_featured === true)
        .sort((a, b) => Date.parse(String(b.created_at ?? 0)) - Date.parse(String(a.created_at ?? 0)))
        .slice(0, 8)
        .map((p) => mapApiProductToDetails(p, categoriesMap));
    },
  });
};
