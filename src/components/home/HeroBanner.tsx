import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const HeroBanner = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-secondary">
      {/* Background image placeholder - soft pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 50m-40 0a40,40 0 1,0 80,0a40,40 0 1,0 -80,0' fill='none' stroke='%23000' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
        }}
      />
      
      {/* Soft gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/40" />

      <div className="container relative z-10 text-center pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-foreground mb-6 tracking-wide">
            Aavis Decor
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <h2 className="font-display text-xl md:text-2xl lg:text-3xl text-foreground/80 mb-8 font-normal italic">
            Weaving beautiful life stories
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="text-sm text-muted-foreground tracking-widest mb-12">
            Pillow Covers | Table Cloths | Curtains
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
        >
          <Link
            to="/collections"
            className="inline-block bg-foreground text-background px-10 py-4 text-xs tracking-widest font-medium hover:bg-foreground/90 transition-colors"
          >
            SHOP NOW
          </Link>
        </motion.div>
      </div>

      {/* Featured In section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-12 left-0 right-0"
      >
        <p className="text-[10px] text-muted-foreground tracking-widest text-center mb-4">
          AS FEATURED IN
        </p>
        <div className="flex justify-center items-center gap-8 md:gap-12 opacity-40">
          <span className="text-sm font-display italic">Vogue</span>
          <span className="text-sm font-display italic">AD India</span>
          <span className="text-sm font-display italic">Elle Decor</span>
          <span className="text-sm font-display italic hidden md:block">Architectural Digest</span>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroBanner;
