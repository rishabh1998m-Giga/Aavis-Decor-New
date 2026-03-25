import { useQuery } from "@tanstack/react-query";
import { apiJson, ApiRequestError } from "@/lib/api";
import { resolveProductGstRate } from "@/lib/gstRate";

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
      const rows = await apiJson<ApiCategory[]>("/api/categories");
      return rows.map((c) => mapCategoryFromApi(c)!);
    },
  });
};

export const useCategoryImages = (categories: Category[]) => {
  const needImage = categories.filter((c) => !c.imageUrl);
  return useQuery({
    queryKey: ["category-images", needImage.map((c) => c.id)],
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      if (needImage.length === 0) return map;
      const data = await apiJson<Record<string, string>>("/api/categories/representative-images", {
        method: "POST",
        body: JSON.stringify({ ids: needImage.map((c) => c.id) }),
      });
      Object.entries(data).forEach(([k, v]) => { if (v) map.set(k, v); });
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
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (categorySlug) sp.set("categorySlug", categorySlug);
      sp.set("sortBy", sortBy);
      if (fabric) sp.set("fabric", fabric);
      if (priceMin != null) sp.set("priceMin", String(priceMin));
      if (priceMax != null) sp.set("priceMax", String(priceMax));
      if (colors?.length) sp.set("colors", colors.join(","));
      if (sizes?.length) sp.set("sizes", sizes.join(","));
      if (inStockOnly) sp.set("inStockOnly", "true");

      const res = await apiJson<{
        products: ApiProduct[];
        totalCount: number;
        totalPages: number;
        currentPage: number;
      }>(`/api/products/paginated?${sp.toString()}`);

      const categoriesSnap = await apiJson<ApiCategory[]>("/api/categories");
      const categoriesMap = new Map<string, Category>();
      categoriesSnap.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });

      const products = res.products.map((p) => mapApiProductToDetails(p, categoriesMap));
      return {
        products,
        totalCount: res.totalCount,
        totalPages: res.totalPages,
        currentPage: res.currentPage,
      };
    },
  });
};

export const useProducts = (categorySlug?: string) => {
  return useQuery({
    queryKey: ["products", categorySlug],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (categorySlug) sp.set("categorySlug", normalizeSlug(categorySlug));
      const q = sp.toString();
      const rows = await apiJson<ApiProduct[]>(`/api/products/list${q ? `?${q}` : ""}`);
      const categoriesSnap = await apiJson<ApiCategory[]>("/api/categories");
      const categoriesMap = new Map<string, Category>();
      categoriesSnap.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });
      return rows.map((p) => mapApiProductToDetails(p, categoriesMap));
    },
  });
};

export const useProduct = (slug: string) => {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      try {
        const enc = encodeURIComponent(slug);
        const row = await apiJson<ApiProduct>(`/api/products/by-slug/${enc}`);
        return mapApiProductToDetails(row);
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 404) {
          throw new Error("Product not found");
        }
        throw e;
      }
    },
    enabled: !!slug,
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const rows = await apiJson<ApiProduct[]>("/api/products/featured");
      const categoriesSnap = await apiJson<ApiCategory[]>("/api/categories");
      const categoriesMap = new Map<string, Category>();
      categoriesSnap.forEach((c) => {
        const mc = mapCategoryFromApi(c);
        if (mc) categoriesMap.set(c.id, mc);
      });
      return rows.map((p) => mapApiProductToDetails(p, categoriesMap));
    },
  });
};
