import type { FastifyInstance } from "fastify";
import { eq, and, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";

function normalizeSlug(value?: string) {
  return decodeURIComponent(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function toSnakeProductRow(p: typeof t.products.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    short_description: p.shortDescription,
    base_price: p.basePrice != null ? Number(p.basePrice) : 0,
    compare_at_price: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    gst_rate: p.gstRate != null ? Number(p.gstRate) : null,
    category_id: p.categoryId,
    is_active: p.isActive ?? true,
    is_featured: p.isFeatured ?? false,
    design_name: p.designName,
    tags: p.tags,
    fabric: p.fabric,
    dimensions: p.dimensions,
    care_instructions: p.careInstructions,
    created_at: p.createdAt ?? "",
    max_variant_price: p.maxVariantPrice != null ? Number(p.maxVariantPrice) : null,
  };
}

async function loadCategoriesMap() {
  const cats = await db
    .select()
    .from(t.categories)
    .where(eq(t.categories.isActive, true));
  return new Map(
    cats.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image_url: c.imageUrl,
        is_active: c.isActive,
        sort_order: c.sortOrder,
      },
    ])
  );
}

async function attachVariantsAndImages(productIds: string[]) {
  if (!productIds.length) {
    return { variants: [] as typeof t.productVariants.$inferSelect[], images: [] as typeof t.productImages.$inferSelect[] };
  }
  const idBatch = productIds.slice(0, 30);
  const [variants, images] = await Promise.all([
    db
      .select()
      .from(t.productVariants)
      .where(
        and(
          inArray(t.productVariants.productId, idBatch),
          eq(t.productVariants.isActive, true)
        )
      ),
    db
      .select()
      .from(t.productImages)
      .where(inArray(t.productImages.productId, idBatch)),
  ]);
  return { variants, images };
}

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get("/api/categories", async () => {
    const rows = await db
      .select()
      .from(t.categories)
      .where(eq(t.categories.isActive, true))
      .orderBy(asc(t.categories.sortOrder));
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image_url: c.imageUrl,
      is_active: c.isActive,
      sort_order: c.sortOrder,
    }));
  });

  app.post("/api/categories/representative-images", async (req) => {
    const body = (req.body as { ids?: string[] }) || {};
    const needIds = (body.ids || []).filter(Boolean);
    const result: Record<string, string> = {};
    if (!needIds.length) return result;

    const categoriesMap = await loadCategoriesMap();
    for (const catId of needIds) {
      const cat = categoriesMap.get(catId);
      if (cat?.image_url) continue;

      const prod = await db
        .select()
        .from(t.products)
        .where(
          and(eq(t.products.isActive, true), eq(t.products.categoryId, catId))
        )
        .orderBy(desc(t.products.createdAt))
        .limit(1);
      if (!prod.length) continue;
      const pid = prod[0].id;
      const imgs = await db
        .select()
        .from(t.productImages)
        .where(eq(t.productImages.productId, pid))
        .orderBy(asc(t.productImages.sortOrder))
        .limit(1);
      if (imgs[0]?.url) result[catId] = imgs[0].url;
    }
    return result;
  });

  app.get("/api/products/paginated", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20));
    const categorySlug = q.categorySlug;
    const sortBy = q.sortBy || "newest";
    const fabric = q.fabric;
    const priceMin = q.priceMin != null ? Number(q.priceMin) : undefined;
    const priceMax = q.priceMax != null ? Number(q.priceMax) : undefined;
    const colors = q.colors?.split(",").filter(Boolean) || [];
    const sizes = q.sizes?.split(",").filter(Boolean) || [];
    const inStockOnly = q.inStockOnly === "true";

    let categoryId: string | null = null;
    const normalizedCategorySlug = normalizeSlug(categorySlug);
    if (normalizedCategorySlug) {
      const cats = await db
        .select()
        .from(t.categories)
        .where(eq(t.categories.isActive, true));
      const match = cats.find(
        (c) => normalizeSlug(c.slug ?? "") === normalizedCategorySlug
      );
      if (match) categoryId = match.id;
      else {
        return {
          products: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
        };
      }
    }

    const conditions = [eq(t.products.isActive, true)];
    if (categoryId) conditions.push(eq(t.products.categoryId, categoryId));
    if (fabric) conditions.push(eq(t.products.fabric, fabric));
    if (priceMin != null && priceMin > 0) {
      conditions.push(gte(t.products.maxVariantPrice, String(priceMin)));
    }
    if (priceMax != null && priceMax > 0) {
      conditions.push(lte(t.products.basePrice, String(priceMax)));
    }

    const hasPriceFilter = priceMin != null || priceMax != null;
    const hasPriceMin = priceMin != null && priceMin > 0;

    const orderParts = (() => {
      if (hasPriceMin)
        return [asc(t.products.maxVariantPrice), desc(t.products.createdAt)];
      if (sortBy === "price-high") return [desc(t.products.basePrice)];
      if (sortBy === "price-low" || hasPriceFilter)
        return [asc(t.products.basePrice)];
      if (sortBy === "name") return [asc(t.products.name)];
      return [desc(t.products.createdAt)];
    })();

    const whereClause = and(...conditions);

    const countRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(t.products)
      .where(whereClause);
    const totalCount = countRows[0]?.c ?? 0;

    const offset = (page - 1) * pageSize;
    const take = offset + pageSize;

    const pageRows = await db
      .select()
      .from(t.products)
      .where(whereClause)
      .orderBy(...orderParts)
      .limit(take);

    const sliced = pageRows.slice(offset, offset + pageSize);
    const productIds = sliced.map((r) => r.id);

    const categoriesMap = await loadCategoriesMap();
    const { variants, images } = await attachVariantsAndImages(productIds);

    const variantsOut = variants.map((d) => ({
      id: d.id,
      product_id: d.productId,
      sku: d.sku,
      color: d.color ?? null,
      size: d.size ?? null,
      price: Number(d.price),
      compare_at_price:
        d.compareAtPrice != null ? Number(d.compareAtPrice) : null,
      stock_quantity: d.stockQuantity ?? 0,
      is_active: d.isActive ?? true,
    }));

    const imagesOut = images.map((img) => ({
      id: img.id,
      product_id: img.productId,
      variant_id: img.variantId ?? null,
      url: img.url,
      alt_text: img.altText ?? null,
      is_primary: img.isPrimary ?? false,
      sort_order: img.sortOrder ?? 0,
    }));

    let products = sliced.map((row) => ({
      ...toSnakeProductRow(row),
      category: row.categoryId
        ? categoriesMap.get(row.categoryId) ?? null
        : null,
      variants: variantsOut.filter((v) => v.product_id === row.id),
      images: imagesOut
        .filter((img) => img.product_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    if (colors.length) {
      products = products.filter((p) =>
        p.variants.some((v) => v.color && colors.includes(v.color))
      );
    }
    if (sizes.length) {
      products = products.filter((p) =>
        p.variants.some((v) => v.size && sizes.includes(v.size))
      );
    }
    if (inStockOnly) {
      products = products.filter((p) =>
        p.variants.some((v) => v.stock_quantity > 0)
      );
    }

    return {
      products,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
    };
  });

  app.get("/api/products/list", async (req) => {
    const q = req.query as { categorySlug?: string };
    let categoryId: string | null = null;
    const normalizedCategorySlug = normalizeSlug(q.categorySlug);
    if (normalizedCategorySlug) {
      const cats = await db
        .select()
        .from(t.categories)
        .where(eq(t.categories.isActive, true));
      const match = cats.find(
        (c) => normalizeSlug(c.slug ?? "") === normalizedCategorySlug
      );
      if (match) categoryId = match.id;
      else return [];
    }

    const conditions = [eq(t.products.isActive, true)];
    if (categoryId) conditions.push(eq(t.products.categoryId, categoryId));

    const prows = await db
      .select()
      .from(t.products)
      .where(and(...conditions))
      .orderBy(desc(t.products.createdAt))
      .limit(50);

    const productIds = prows.map((d) => d.id);
    const categoriesMap = await loadCategoriesMap();
    const { variants, images } = await attachVariantsAndImages(productIds);

    const variantsOut = variants.map((d) => ({
      id: d.id,
      product_id: d.productId,
      sku: d.sku,
      color: d.color ?? null,
      size: d.size ?? null,
      price: Number(d.price),
      compare_at_price:
        d.compareAtPrice != null ? Number(d.compareAtPrice) : null,
      stock_quantity: d.stockQuantity ?? 0,
      is_active: d.isActive ?? true,
    }));

    const imagesOut = images.map((img) => ({
      id: img.id,
      product_id: img.productId,
      variant_id: img.variantId ?? null,
      url: img.url,
      alt_text: img.altText ?? null,
      is_primary: img.isPrimary ?? false,
      sort_order: img.sortOrder ?? 0,
    }));

    return prows.map((row) => ({
      ...toSnakeProductRow(row),
      category: row.categoryId
        ? categoriesMap.get(row.categoryId) ?? null
        : null,
      variants: variantsOut.filter((v) => v.product_id === row.id),
      images: imagesOut
        .filter((img) => img.product_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  });

  app.get("/api/products/featured", async () => {
    const prows = await db
      .select()
      .from(t.products)
      .where(and(eq(t.products.isActive, true), eq(t.products.isFeatured, true)))
      .orderBy(desc(t.products.createdAt))
      .limit(8);

    const productIds = prows.map((d) => d.id);
    const categoriesMap = await loadCategoriesMap();
    const { variants, images } = await attachVariantsAndImages(productIds);

    const variantsOut = variants.map((d) => ({
      id: d.id,
      product_id: d.productId,
      sku: d.sku,
      color: d.color ?? null,
      size: d.size ?? null,
      price: Number(d.price),
      compare_at_price:
        d.compareAtPrice != null ? Number(d.compareAtPrice) : null,
      stock_quantity: d.stockQuantity ?? 0,
      is_active: d.isActive ?? true,
    }));

    const imagesOut = images.map((img) => ({
      id: img.id,
      product_id: img.productId,
      variant_id: img.variantId ?? null,
      url: img.url,
      alt_text: img.altText ?? null,
      is_primary: img.isPrimary ?? false,
      sort_order: img.sortOrder ?? 0,
    }));

    return prows.map((row) => ({
      ...toSnakeProductRow(row),
      category: row.categoryId
        ? categoriesMap.get(row.categoryId) ?? null
        : null,
      variants: variantsOut.filter((v) => v.product_id === row.id),
      images: imagesOut
        .filter((img) => img.product_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  });

  app.get("/api/products/by-slug/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const rows = await db
      .select()
      .from(t.products)
      .where(and(eq(t.products.slug, slug), eq(t.products.isActive, true)))
      .limit(1);
    if (!rows.length) return reply.status(404).send({ error: "Not found" });

    const row = rows[0];
    const productId = row.id;
    const [variants, images] = await Promise.all([
      db
        .select()
        .from(t.productVariants)
        .where(
          and(
            eq(t.productVariants.productId, productId),
            eq(t.productVariants.isActive, true)
          )
        ),
      db
        .select()
        .from(t.productImages)
        .where(eq(t.productImages.productId, productId)),
    ]);

    let category = null;
    if (row.categoryId) {
      const c = await db
        .select()
        .from(t.categories)
        .where(eq(t.categories.id, row.categoryId))
        .limit(1);
      if (c.length) {
        category = {
          id: c[0].id,
          name: c[0].name,
          slug: c[0].slug,
          description: c[0].description,
          image_url: c[0].imageUrl,
          is_active: c[0].isActive,
          sort_order: c[0].sortOrder,
        };
      }
    }

    return {
      ...toSnakeProductRow(row),
      category,
      variants: variants.map((v) => ({
        id: v.id,
        product_id: v.productId,
        sku: v.sku,
        color: v.color ?? null,
        size: v.size ?? null,
        price: Number(v.price),
        compare_at_price:
          v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        stock_quantity: v.stockQuantity ?? 0,
        is_active: v.isActive ?? true,
      })),
      images: images
        .map((img) => ({
          id: img.id,
          product_id: img.productId,
          variant_id: img.variantId ?? null,
          url: img.url,
          alt_text: img.altText ?? null,
          is_primary: img.isPrimary ?? false,
          sort_order: img.sortOrder ?? 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  });

  app.get("/api/products/by-id/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const rows = await db
      .select()
      .from(t.products)
      .where(eq(t.products.id, id))
      .limit(1);
    if (!rows.length) return reply.status(404).send(null);
    return { slug: rows[0].slug };
  });

  app.get("/api/products/resolve-slug/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const bySlug = await db
      .select()
      .from(t.products)
      .where(and(eq(t.products.slug, slug), eq(t.products.isActive, true)))
      .limit(1);
    if (bySlug.length) return { slug: bySlug[0].slug };

    const candidates = await db
      .select()
      .from(t.products)
      .where(eq(t.products.isActive, true));

    const escaped = candidates.find((p) => {
      const aliases = p.slugAliases ?? [];
      return aliases.includes(slug);
    });
    if (escaped) return { slug: escaped.slug };
    return reply.status(404).send({ slug: null });
  });

  app.get("/api/collections/by-slug/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const rows = await db
      .select()
      .from(t.collections)
      .where(
        and(eq(t.collections.slug, slug), eq(t.collections.isActive, true))
      )
      .limit(1);
    if (!rows.length) return reply.status(404).send(null);
    const c = rows[0];
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      image_url: c.imageUrl,
      type: c.type,
      rules: c.rules,
      is_active: c.isActive,
      sort_order: c.sortOrder,
    };
  });

  app.get("/api/collections/:id/products", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const coll = await db
      .select()
      .from(t.collections)
      .where(eq(t.collections.id, id))
      .limit(1);
    if (!coll.length) return reply.status(404).send([]);

    const collectionData = coll[0];

    const categoriesMap = await loadCategoriesMap();

    if (collectionData.type === "manual") {
      const cp = await db
        .select()
        .from(t.collectionProducts)
        .where(eq(t.collectionProducts.collectionId, id))
        .orderBy(asc(t.collectionProducts.sortOrder));
      if (!cp.length) return [];

      const productIds = cp.map((x) => x.productId);
      const prows = await db
        .select()
        .from(t.products)
        .where(inArray(t.products.id, productIds.slice(0, 50)));
      const orderMap = new Map(productIds.map((pid, i) => [pid, i]));
      prows.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
      );

      const { variants, images } = await attachVariantsAndImages(
        prows.map((p) => p.id)
      );

      return prows.map((row) => ({
        ...toSnakeProductRow(row),
        category: row.categoryId
          ? categoriesMap.get(row.categoryId) ?? null
          : null,
        variants: variants
          .filter(
            (v) =>
              v.productId === row.id && (v.isActive ?? true)
          )
          .map((v) => ({
            id: v.id,
            product_id: v.productId,
            sku: v.sku,
            color: v.color ?? null,
            size: v.size ?? null,
            price: Number(v.price),
            compare_at_price:
              v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
            stock_quantity: v.stockQuantity ?? 0,
            is_active: true,
          })),
        images: images
          .filter((img) => img.productId === row.id)
          .map((img) => ({
            id: img.id,
            product_id: img.productId,
            variant_id: img.variantId ?? null,
            url: img.url,
            alt_text: img.altText ?? null,
            is_primary: img.isPrimary ?? false,
            sort_order: img.sortOrder ?? 0,
          }))
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
    }

    if (collectionData.type === "automatic" && collectionData.rules) {
      const rules = collectionData.rules as { tags?: string[] };
      const tagList = rules.tags || [];
      if (!tagList.length) return [];

      const tagSlice = tagList.slice(0, 10);
      const active = await db
        .select()
        .from(t.products)
        .where(eq(t.products.isActive, true))
        .limit(200);
      const prows = active
        .filter((p) => {
          const tags = p.tags ?? [];
          return tagSlice.some((tg) => tags.includes(tg));
        })
        .slice(0, 30);

      const { variants, images } = await attachVariantsAndImages(
        prows.map((p) => p.id)
      );

      return prows.map((row) => {
        const catData = row.categoryId
          ? categoriesMap.get(row.categoryId)
          : null;
        return {
          ...toSnakeProductRow(row),
          category: catData,
          variants: variants
            .filter(
              (v) =>
                v.productId === row.id && (v.isActive ?? true)
            )
            .map((v) => ({
              id: v.id,
              product_id: v.productId,
              sku: v.sku,
              color: v.color ?? null,
              size: v.size ?? null,
              price: Number(v.price),
              compare_at_price:
                v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
              stock_quantity: v.stockQuantity ?? 0,
              is_active: true,
            })),
          images: images
            .filter((img) => img.productId === row.id)
            .map((img) => ({
              id: img.id,
              product_id: img.productId,
              variant_id: img.variantId ?? null,
              url: img.url,
              alt_text: img.altText ?? null,
              is_primary: img.isPrimary ?? false,
              sort_order: img.sortOrder ?? 0,
            }))
            .sort((a, b) => a.sort_order - b.sort_order),
        };
      });
    }

    return [];
  });

  app.get("/api/pincode/:pincode", async (req) => {
    const pincode = (req.params as { pincode: string }).pincode;
    const rows = await db
      .select()
      .from(t.pincodeServiceability)
      .where(eq(t.pincodeServiceability.pincode, pincode))
      .limit(1);
    if (!rows.length) return null;
    const r = rows[0];
    if (r.isServiceable === false) return null;
    return {
      id: r.id,
      pincode: r.pincode,
      is_serviceable: r.isServiceable,
      is_cod_available: r.isCodAvailable,
      city: r.city,
      state: r.state,
      estimated_days: r.estimatedDays,
    };
  });

  // Public shipping config — used by frontend to calculate order totals
  app.get("/api/shipping-config", async () => {
    const rows = await db
      .select()
      .from(t.shippingRules)
      .where(eq(t.shippingRules.isActive, true))
      .limit(1);
    const r = rows[0];
    return {
      flatRate: r?.flatRate != null ? Number(r.flatRate) : 99,
      freeShippingThreshold: r?.freeShippingThreshold != null ? Number(r.freeShippingThreshold) : 999,
      codFee: r?.codFee != null ? Number(r.codFee) : 49,
      isCodAvailable: r?.isCodAvailable ?? true,
    };
  });
}
