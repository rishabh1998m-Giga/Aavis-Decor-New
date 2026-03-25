import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCategories, useCategoryImages } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

const CategoryShowcase = () => {
  const { data: categories = [], isLoading, isError } = useCategories();
  const { data: imageMap = new Map<string, string>() } = useCategoryImages(categories);

  return (
    <section className="py-24 md:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 md:mb-20"
        >
          <p className="text-[11px] tracking-[0.25em] text-muted-foreground mb-4 uppercase">Curated Collections</p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-foreground mb-4">
            Shop by Category
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Each piece thoughtfully crafted to bring warmth and character to your home
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              ))
            : categories.length === 0
            ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="md:col-span-3 text-center py-12"
                >
                  <p className="text-foreground/60 text-sm mb-4">
                    {isError
                      ? "Unable to load categories. Try refreshing."
                      : "No categories available yet. Import catalog data to populate this section."}
                  </p>
                  <Link
                    to="/collections"
                    className="inline-block text-xs tracking-widest uppercase text-foreground font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
                  >
                    Shop all products
                  </Link>
                </motion.div>
              )
            : categories.map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                >
                  <Link to={`/category/${cat.slug}`} className="group block relative">
                    <div className="aspect-[3/4] bg-muted overflow-hidden relative">
                      {(cat.imageUrl || imageMap.get(cat.id)) ? (
                        <img
                          src={cat.imageUrl || imageMap.get(cat.id)!}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                          <span className="text-7xl opacity-10">✦</span>
                        </div>
                      )}
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
                      
                      {/* Category name on image */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <h3 className="font-display text-2xl md:text-3xl text-background mb-2">
                          {cat.name}
                        </h3>
                        <div className="flex items-center gap-2 text-background/70 group-hover:text-background transition-colors">
                          <span className="text-xs tracking-widest uppercase">Explore</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryShowcase;
