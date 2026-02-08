import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock data - will be replaced with Supabase data
const mockProducts = [
  { id: "1", name: "Tropical Leaf Pillow Cover", price: 499, comparePrice: 799, category: "Pillow Covers", color: "Green" },
  { id: "2", name: "Moroccan Pattern Table Cloth", price: 899, comparePrice: 1299, category: "Table Cloths", color: "Blue" },
  { id: "3", name: "Sheer Linen Curtain", price: 1499, comparePrice: 2199, category: "Curtains", color: "Ivory" },
  { id: "4", name: "Geometric Velvet Pillow Cover", price: 599, comparePrice: 999, category: "Pillow Covers", color: "Mustard" },
  { id: "5", name: "Floral Block Print Table Cloth", price: 749, comparePrice: null, category: "Table Cloths", color: "Red" },
  { id: "6", name: "Blackout Velvet Curtain", price: 1999, comparePrice: 2999, category: "Curtains", color: "Emerald" },
  { id: "7", name: "Boho Tassel Pillow Cover", price: 449, comparePrice: 699, category: "Pillow Covers", color: "Terracotta" },
  { id: "8", name: "Jacquard Silk Table Cloth", price: 1199, comparePrice: 1799, category: "Table Cloths", color: "Gold" },
];

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
};

const FeaturedProducts = () => {
  return (
    <section className="py-16 md:py-24 bg-secondary/50">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            Trending Now
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Our most loved designs, handpicked for you
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {mockProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group"
            >
              <div className="relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                {/* Image placeholder */}
                <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                  <span className="text-4xl opacity-30">🎨</span>

                  {/* Quick actions */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-background/90 rounded-full hover:bg-background transition-colors">
                      <Heart className="h-4 w-4 text-foreground" />
                    </button>
                  </div>

                  {/* Discount badge */}
                  {product.comparePrice && (
                    <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                      {Math.round((1 - product.price / product.comparePrice) * 100)}% OFF
                    </span>
                  )}
                </div>

                <div className="p-3 md:p-4">
                  <p className="text-xs text-muted-foreground mb-1">{product.category}</p>
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2 leading-snug">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{formatPrice(product.price)}</span>
                    {product.comparePrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.comparePrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg" className="rounded-full px-8">
            View All Products
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
