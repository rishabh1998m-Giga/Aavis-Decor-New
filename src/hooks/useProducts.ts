import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

// Map raw DB row to typed product
const mapProduct = (p: any): ProductWithDetails => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  shortDescription: p.short_description,
  basePrice: Number(p.base_price),
  compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
  gstRate: Number(p.gst_rate ?? 18),
  categoryId: p.category_id,
  isActive: p.is_active ?? true,
  isFeatured: p.is_featured ?? false,
  designName: p.design_name,
  tags: p.tags,
  fabric: p.fabric ?? null,
  dimensions: p.dimensions ?? null,
  careInstructions: p.care_instructions ?? null,
  createdAt: p.created_at ?? "",
  category: p.categories
    ? {
        id: p.categories.id,
        name: p.categories.name,
        slug: p.categories.slug,
        description: p.categories.description,
        imageUrl: p.categories.image_url,
        isActive: p.categories.is_active ?? true,
        sortOrder: p.categories.sort_order ?? 0,
      }
    : null,
  variants: (p.product_variants || []).map((v: any) => ({
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    color: v.color,
    size: v.size,
    price: Number(v.price),
    compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
    stockQuantity: v.stock_quantity ?? 0,
    isActive: v.is_active ?? true,
  })),
  images: (p.product_images || [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img: any) => ({
      id: img.id,
      productId: img.product_id,
      variantId: img.variant_id,
      url: img.url,
      altText: img.alt_text,
      isPrimary: img.is_primary ?? false,
      sortOrder: img.sort_order ?? 0,
    })),
});

const PRODUCT_SELECT = `
  *,
  categories!products_category_id_fkey (
    id, name, slug, description, image_url, is_active, sort_order
  ),
  product_variants (
    id, product_id, sku, color, size, price, compare_at_price, stock_quantity, is_active
  ),
  product_images (
    id, product_id, variant_id, url, alt_text, is_primary, sort_order
  )
`;

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

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;

      return data.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.image_url,
        isActive: cat.is_active ?? true,
        sortOrder: cat.sort_order ?? 0,
      })) as Category[];
    },
  });
};

export const usePaginatedProducts = (params: PaginatedProductsParams = {}) => {
  const { page = 1, pageSize = 20, categorySlug, sortBy = "newest", colors, sizes, fabric, priceMin, priceMax, inStockOnly } = params;

  return useQuery({
    queryKey: ["products-paginated", page, pageSize, categorySlug, sortBy, colors, sizes, fabric, priceMin, priceMax, inStockOnly],
    queryFn: async (): Promise<PaginatedResult> => {
      let query = supabase
        .from("products")
        .select(PRODUCT_SELECT, { count: "exact" })
        .eq("is_active", true);

      if (categorySlug) {
        // Get category ID first
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categorySlug)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }

      if (fabric) {
        query = query.eq("fabric", fabric);
      }

      if (priceMin !== undefined) {
        query = query.gte("base_price", priceMin);
      }
      if (priceMax !== undefined) {
        query = query.lte("base_price", priceMax);
      }

      // Sorting
      switch (sortBy) {
        case "price-low":
          query = query.order("base_price", { ascending: true });
          break;
        case "price-high":
          query = query.order("base_price", { ascending: false });
          break;
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "newest":
        default:
          query = query.order("created_at", { ascending: false });
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let products = (data || []).map(mapProduct);

      // Client-side variant filters (color, size, inStock)
      if (colors && colors.length > 0) {
        products = products.filter((p) =>
          p.variants.some((v) => v.color && colors.includes(v.color))
        );
      }
      if (sizes && sizes.length > 0) {
        products = products.filter((p) =>
          p.variants.some((v) => v.size && sizes.includes(v.size))
        );
      }
      if (inStockOnly) {
        products = products.filter((p) =>
          p.variants.some((v) => v.stockQuantity > 0)
        );
      }

      const totalCount = count || 0;

      return {
        products,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      };
    },
  });
};

// Legacy hook - still used by Product page for related products
export const useProducts = (categorySlug?: string) => {
  return useQuery({
    queryKey: ["products", categorySlug],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_active", true);

      if (categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categorySlug)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []).map(mapProduct);
    },
  });
};

export const useProduct = (slug: string) => {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return mapProduct(data);
    },
    enabled: !!slug,
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_variants (
            id, product_id, sku, color, size, price, compare_at_price, stock_quantity, is_active
          ),
          product_images (
            id, product_id, variant_id, url, alt_text, is_primary, sort_order
          )
        `)
        .eq("is_active", true)
        .eq("is_featured", true)
        .limit(8);

      if (error) throw error;
      return (data || []).map((p) => ({ ...mapProduct(p), category: null }));
    },
  });
};
