import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFeaturedProducts, useProducts } from "@/hooks/useProducts";
import heroImageFallback from "@/assets/hero-home.jpg";

const HeroBanner = () => {
  const { data: featuredProducts = [] } = useFeaturedProducts();
  const { data: allProducts = [] } = useProducts();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(() => {
    const withImage = (p: (typeof allProducts)[number]) => {
      const image =
        p.images?.find((img) => img.isPrimary)?.url ?? p.images?.[0]?.url ?? null;
      return image ? { product: p, src: image } : null;
    };

    const featuredSlides = featuredProducts
      .map(withImage)
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (featuredSlides.length >= 3) return featuredSlides.slice(0, 6);

    const seenProductIds = new Set(featuredSlides.map((s) => s.product.id));
    const fallbackSlides = allProducts
      .filter((p) => !seenProductIds.has(p.id))
      .map(withImage)
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return [...featuredSlides, ...fallbackSlides].slice(0, 6);
  }, [featuredProducts, allProducts]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  const active = slides[currentSlide];
  const heroSrc = active?.src ?? heroImageFallback;
  const heroAlt = active
    ? `${active.product.name} – Aavis Decor`
    : "Luxurious Indian home textiles by Aavis Decor";

  const goPrev = () => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };
  const goNext = () => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image carousel from actual catalog images */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={heroSrc}
            src={heroSrc}
            alt={heroAlt}
            className="w-full h-full object-cover"
            loading="eager"
            initial={{ opacity: 0.35, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.2, scale: 1.01 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-foreground/20" />
      </div>

      <div className="container relative z-10 pt-32 pb-20">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <p className="text-[11px] tracking-[0.3em] text-background/60 mb-6 uppercase">
              Artisan Home Textiles
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl text-background mb-6 leading-[1.2]">
              <span className="font-display tracking-wide">Where craft</span>
              <br />
              <span style={{ fontFamily: "'Pinyon Script', cursive" }} className="text-6xl md:text-7xl lg:text-8xl">meets elegance</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          >
            <p className="text-base md:text-lg text-background/70 mb-10 max-w-md leading-relaxed font-light">
              Hand-crafted pillow covers, curtains & table linens that transform your spaces into stories of warmth and beauty.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
            className="flex items-center gap-5"
          >
            <Link
              to="/collections"
              className="inline-block bg-background text-foreground px-10 py-4 text-xs tracking-widest font-medium hover:bg-background/90 transition-colors"
            >
              SHOP COLLECTION
            </Link>
            <Link
              to="/about"
              className="inline-block text-background/80 text-xs tracking-widest font-medium hover:text-background transition-colors border-b border-background/30 pb-1"
            >
              OUR STORY
            </Link>
          </motion.div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/20 text-background hover:bg-background/35 transition-colors flex items-center justify-center"
            aria-label="Previous hero image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/20 text-background hover:bg-background/35 transition-colors flex items-center justify-center"
            aria-label="Next hero image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((s, idx) => (
            <button
              key={`${s.product.id}-${idx}`}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 transition-all ${
                idx === currentSlide
                  ? "w-6 bg-background"
                  : "w-3 bg-background/50 hover:bg-background/75"
              }`}
              aria-label={`Go to hero slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] text-background/40 tracking-widest">SCROLL</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-background/40 to-transparent"
        />
      </motion.div>
    </section>
  );
};

export default HeroBanner;
