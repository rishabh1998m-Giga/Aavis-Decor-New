import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-home.jpg";

const HeroBanner = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Luxurious Indian home textiles by Aavis Decor"
          className="w-full h-full object-cover"
          loading="eager"
        />
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
