import { useQuery } from "@tanstack/react-query";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  getCountFromServer,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

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

const mapCategory = (id: string, d: Record<string, unknown>): Category => ({
  id,
  name: (d.name as string) ?? "",
  slug: (d.slug as string) ?? "",
  description: (d.description as string) ?? null,
  imageUrl: (d.image_url as string) ?? null,
  isActive: (d.is_active as boolean) ?? true,
  sortOrder: (d.sort_order as number) ?? 0,
});

const mapProduct = (
  id: string,
  p: Record<string, unknown>,
  categories: Map<string, Category>,
  variants: ProductVariant[],
  images: ProductImage[]
): ProductWithDetails => {
  const catId = p.category_id as string | null;
  return {
    id,
    name: (p.name as string) ?? "",
    slug: (p.slug as string) ?? "",
    description: (p.description as string) ?? null,
    shortDescription: (p.short_description as string) ?? null,
    basePrice: Number(p.base_price ?? 0),
    compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    gstRate: Number(p.gst_rate ?? 18),
    categoryId: catId,
    isActive: (p.is_active as boolean) ?? true,
    isFeatured: (p.is_featured as boolean) ?? false,
    designName: (p.design_name as string) ?? null,
    tags: (p.tags as string[]) ?? null,
    fabric: (p.fabric as string) ?? null,
    dimensions: (p.dimensions as string) ?? null,
    careInstructions: (p.care_instructions as string) ?? null,
    createdAt: (p.created_at as string) ?? "",
    category: catId ? categories.get(catId) ?? null : null,
    variants: variants.filter((v) => v.productId === id).sort((a, b) => a.sku.localeCompare(b.sku)),
    images: images
      .filter((img) => img.productId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
};

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
      const q = query(
        collection(db, "categories"),
        where("is_active", "==", true),
        orderBy("sort_order")
      );
      const snap = await getDocs(q);
      const categories: Category[] = [];
      snap.docs.forEach((d) => {
        categories.push(mapCategory(d.id, d.data()));
      });
      return categories;
    },
  });
};

/** Fetches representative image URL per category (from first product when category has no image_url). */
export const useCategoryImages = (categories: Category[]) => {
  const needImage = categories.filter((c) => !c.imageUrl);
  return useQuery({
    queryKey: ["category-images", needImage.map((c) => c.id)],
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      if (needImage.length === 0) return map;

      const results = await Promise.all(
        needImage.map(async (cat) => {
          const productsSnap = await getDocs(
            query(
              collection(db, "products"),
              where("is_active", "==", true),
              where("category_id", "==", cat.id),
              orderBy("created_at", "desc"),
              limit(1)
            )
          );
          if (productsSnap.empty) return { catId: cat.id, url: null as string | null };
          const productId = productsSnap.docs[0].id;
          const imagesSnap = await getDocs(
            query(
              collection(db, "product_images"),
              where("product_id", "==", productId)
            )
          );
          const sorted = imagesSnap.docs
            .map((d) => ({ ...d.data(), sortOrder: d.data().sort_order ?? 0 }))
            .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));
          const url = sorted[0]?.url;
          return { catId: cat.id, url };
        })
      );
      results.forEach((r) => { if (r.url) map.set(r.catId, r.url); });
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
      let categoryId: string | null = null;
      const normalizedCategorySlug = normalizeSlug(categorySlug);
      if (normalizedCategorySlug) {
        const activeCategoriesSnap = await getDocs(
          query(collection(db, "categories"), where("is_active", "==", true))
        );
        const match = activeCategoriesSnap.docs.find(
          (d) => normalizeSlug((d.data().slug as string) ?? "") === normalizedCategorySlug
        );
        if (match) categoryId = match.id;
        if (!categoryId) {
          return {
            products: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
          };
        }
      }

      const constraints: QueryConstraint[] = [where("is_active", "==", true)];
      if (categoryId) constraints.push(where("category_id", "==", categoryId));
      if (fabric) constraints.push(where("fabric", "==", fabric));
      if (priceMin != null) constraints.push(where("base_price", ">=", priceMin));
      if (priceMax != null) constraints.push(where("base_price", "<=", priceMax));

      const hasPriceFilter = priceMin != null || priceMax != null;
      const orderField =
        hasPriceFilter || sortBy === "price-low" || sortBy === "price-high"
          ? "base_price"
          : sortBy === "name"
            ? "name"
            : "created_at";
      const orderDir =
        sortBy === "price-high"
          ? "desc"
          : sortBy === "price-low" || sortBy === "name"
            ? "asc"
            : "desc";
      constraints.push(orderBy(orderField, orderDir));

      const productsQuery = query(collection(db, "products"), ...constraints);
      const countSnap = await getCountFromServer(productsQuery);
      const totalCount = countSnap.data().count;

      const from = (page - 1) * pageSize;
      const pageQuery = query(productsQuery, limit(pageSize + from));
      const productsSnap = await getDocs(pageQuery);
      const pageDocs = productsSnap.docs.slice(from, from + pageSize);
      const productIds = pageDocs.map((d) => d.id);
      const idBatch = productIds.length > 30 ? productIds.slice(0, 30) : productIds;

      const [variantsSnap, imagesSnap, categoriesSnap] = await Promise.all([
        idBatch.length
          ? getDocs(
              query(
                collection(db, "product_variants"),
                where("product_id", "in", idBatch),
                where("is_active", "==", true)
              )
            )
          : Promise.resolve({ docs: [] as ReturnType<typeof getDocs>["docs"], empty: true }),
        idBatch.length
          ? getDocs(
              query(collection(db, "product_images"), where("product_id", "in", idBatch))
            )
          : Promise.resolve({ docs: [] as ReturnType<typeof getDocs>["docs"], empty: true }),
        getDocs(query(collection(db, "categories"), where("is_active", "==", true))),
      ]);

      const categoriesMap = new Map<string, Category>();
      categoriesSnap.docs.forEach((d) => {
        categoriesMap.set(d.id, mapCategory(d.id, d.data()));
      });

      const variants: ProductVariant[] = [];
      variantsSnap.docs.forEach((d) => {
        const v = d.data();
        variants.push({
          id: d.id,
          productId: v.product_id,
          sku: v.sku,
          color: v.color ?? null,
          size: v.size ?? null,
          price: Number(v.price),
          compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
          stockQuantity: v.stock_quantity ?? 0,
          isActive: v.is_active ?? true,
        });
      });

      const images: ProductImage[] = [];
      imagesSnap.docs.forEach((d) => {
        const img = d.data();
        images.push({
          id: d.id,
          productId: img.product_id,
          variantId: img.variant_id ?? null,
          url: img.url,
          altText: img.alt_text ?? null,
          isPrimary: img.is_primary ?? false,
          sortOrder: img.sort_order ?? 0,
        });
      });

      let products = pageDocs.map((d) =>
        mapProduct(d.id, d.data(), categoriesMap, variants, images)
      );

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
        products = products.filter((p) => p.variants.some((v) => v.stockQuantity > 0));
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
      let categoryId: string | null = null;
      const normalizedCategorySlug = normalizeSlug(categorySlug);
      if (normalizedCategorySlug) {
        const activeCategoriesSnap = await getDocs(
          query(collection(db, "categories"), where("is_active", "==", true))
        );
        const match = activeCategoriesSnap.docs.find(
          (d) => normalizeSlug((d.data().slug as string) ?? "") === normalizedCategorySlug
        );
        if (match) categoryId = match.id;
        if (!categoryId) return [];
      }

      const constraints: QueryConstraint[] = [
        where("is_active", "==", true),
        orderBy("created_at", "desc"),
        limit(50),
      ];
      if (categoryId) constraints.push(where("category_id", "==", categoryId));
      const productsSnap = await getDocs(
        query(collection(db, "products"), ...constraints)
      );
      const productIds = productsSnap.docs.map((d) => d.id);
      const idBatch = productIds.length > 30 ? productIds.slice(0, 30) : productIds;
      if (idBatch.length === 0) return [];

      const [variantsSnap, imagesSnap, categoriesSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "product_variants"),
            where("product_id", "in", idBatch),
            where("is_active", "==", true)
          )
        ),
        getDocs(
          query(
            collection(db, "product_images"),
            where("product_id", "in", idBatch)
          )
        ),
        getDocs(query(collection(db, "categories"), where("is_active", "==", true))),
      ]);

      const categoriesMap = new Map<string, Category>();
      categoriesSnap.docs.forEach((d) => {
        categoriesMap.set(d.id, mapCategory(d.id, d.data()));
      });
      const variants: ProductVariant[] = [];
      variantsSnap.docs.forEach((d) => {
        const v = d.data();
        variants.push({
          id: d.id,
          productId: v.product_id,
          sku: v.sku,
          color: v.color ?? null,
          size: v.size ?? null,
          price: Number(v.price),
          compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
          stockQuantity: v.stock_quantity ?? 0,
          isActive: v.is_active ?? true,
        });
      });
      const images: ProductImage[] = [];
      imagesSnap.docs.forEach((d) => {
        const img = d.data();
        images.push({
          id: d.id,
          productId: img.product_id,
          variantId: img.variant_id ?? null,
          url: img.url,
          altText: img.alt_text ?? null,
          isPrimary: img.is_primary ?? false,
          sortOrder: img.sort_order ?? 0,
        });
      });

      return productsSnap.docs.map((d) =>
        mapProduct(d.id, d.data(), categoriesMap, variants, images)
      );
    },
  });
};

export const useProduct = (slug: string) => {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const productsSnap = await getDocs(
        query(
          collection(db, "products"),
          where("slug", "==", slug),
          where("is_active", "==", true),
          limit(1)
        )
      );
      if (productsSnap.empty) throw new Error("Product not found");
      const productDoc = productsSnap.docs[0];
      const productId = productDoc.id;
      const p = productDoc.data();

      const [variantsSnap, imagesSnap, catDoc] = await Promise.all([
        getDocs(
          query(
            collection(db, "product_variants"),
            where("product_id", "==", productId),
            where("is_active", "==", true)
          )
        ),
        getDocs(
          query(collection(db, "product_images"), where("product_id", "==", productId))
        ),
        p.category_id
          ? getDoc(doc(db, "categories", p.category_id as string))
          : Promise.resolve(null),
      ]);

      const categoriesMap = new Map<string, Category>();
      if (catDoc?.exists()) {
        const c = catDoc;
        categoriesMap.set(c.id, mapCategory(c.id, c.data()));
      }

      const variants: ProductVariant[] = variantsSnap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          productId: v.product_id,
          sku: v.sku,
          color: v.color ?? null,
          size: v.size ?? null,
          price: Number(v.price),
          compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
          stockQuantity: v.stock_quantity ?? 0,
          isActive: v.is_active ?? true,
        };
      });
      const images: ProductImage[] = imagesSnap.docs.map((d) => {
        const img = d.data();
        return {
          id: d.id,
          productId: img.product_id,
          variantId: img.variant_id ?? null,
          url: img.url,
          altText: img.alt_text ?? null,
          isPrimary: img.is_primary ?? false,
          sortOrder: img.sort_order ?? 0,
        };
      });

      return mapProduct(productId, p, categoriesMap, variants, images);
    },
    enabled: !!slug,
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const productsSnap = await getDocs(
        query(
          collection(db, "products"),
          where("is_active", "==", true),
          where("is_featured", "==", true),
          orderBy("created_at", "desc"),
          limit(8)
        )
      );
      const productIds = productsSnap.docs.map((d) => d.id);
      const idBatch = productIds.length > 30 ? productIds.slice(0, 30) : productIds;
      if (idBatch.length === 0) return [];

      const [variantsSnap, imagesSnap, categoriesSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "product_variants"),
            where("product_id", "in", idBatch),
            where("is_active", "==", true)
          )
        ),
        getDocs(
          query(
            collection(db, "product_images"),
            where("product_id", "in", idBatch))
        ),
        getDocs(query(collection(db, "categories"), where("is_active", "==", true))),
      ]);

      const categoriesMap = new Map<string, Category>();
      categoriesSnap.docs.forEach((d) => {
        categoriesMap.set(d.id, mapCategory(d.id, d.data()));
      });
      const variants: ProductVariant[] = variantsSnap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          productId: v.product_id,
          sku: v.sku,
          color: v.color ?? null,
          size: v.size ?? null,
          price: Number(v.price),
          compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
          stockQuantity: v.stock_quantity ?? 0,
          isActive: v.is_active ?? true,
        };
      });
      const images: ProductImage[] = imagesSnap.docs.map((d) => {
        const img = d.data();
        return {
          id: d.id,
          productId: img.product_id,
          variantId: img.variant_id ?? null,
          url: img.url,
          altText: img.alt_text ?? null,
          isPrimary: img.is_primary ?? false,
          sortOrder: img.sort_order ?? 0,
        };
      });

      return productsSnap.docs.map((d) =>
        mapProduct(d.id, d.data(), categoriesMap, variants, images)
      );
    },
  });
};
