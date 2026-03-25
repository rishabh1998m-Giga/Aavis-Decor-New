import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useFeaturedProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/products/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

const FeaturedProducts = () => {
  const { data: products = [], isLoading, isError } = useFeaturedProducts();

  return (
    <section className="py-24 md:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 md:mb-20"
        >
          <div>
            <p className="text-[11px] tracking-[0.25em] text-muted-foreground mb-4 uppercase">
              Handpicked for you
            </p>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-foreground">
              Best Sellers
            </h2>
          </div>
          <Link
            to="/collections"
            className="mt-6 md:mt-0 inline-block text-xs tracking-widest uppercase text-foreground font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors self-start md:self-auto"
          >
            View all products
          </Link>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-12">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded border border-border/40 bg-muted/20 p-10 text-center">
            <p className="text-foreground/70 text-sm">
              {isError
                ? "Best sellers are temporarily unavailable."
                : "No featured products yet. Import catalog data to populate this section."}
            </p>
            <Link
              to="/collections"
              className="mt-4 inline-block text-xs tracking-widest uppercase text-foreground font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
            >
              View all products
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedProducts;
