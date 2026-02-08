import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const categories = [
  {
    name: "Pillow Covers",
    slug: "pillow-covers",
    description: "Add a pop of color to your living room",
    emoji: "🛋️",
    color: "from-primary/10 to-warm/10",
  },
  {
    name: "Table Cloths",
    slug: "table-cloths",
    description: "Elegant designs for every dining occasion",
    emoji: "🍽️",
    color: "from-accent/10 to-success/10",
  },
  {
    name: "Curtains",
    slug: "curtains",
    description: "Transform your windows, transform your space",
    emoji: "🪟",
    color: "from-gold/10 to-primary/10",
  },
];

const CategoryShowcase = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            Shop by Category
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Curated collections for every corner of your home
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link
                to={`/category/${cat.slug}`}
                className={`group block rounded-2xl bg-gradient-to-br ${cat.color} p-8 md:p-10 border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg`}
              >
                <span className="text-5xl mb-6 block">{cat.emoji}</span>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  {cat.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {cat.description}
                </p>
                <span className="inline-flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
                  Browse Collection <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryShowcase;
