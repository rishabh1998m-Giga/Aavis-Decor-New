import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { ProductImage } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ImageGalleryProps {
  images: ProductImage[];
  productName: string;
  /** Shown when there are no images for the current variant (e.g. color name). */
  emptyLabel?: string | null;
}

const ImageGallery = ({ images, productName, emptyLabel }: ImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);
  const currentImage = sortedImages[currentIndex] || { url: "/placeholder.svg", altText: productName };

  if (sortedImages.length === 0) {
    return (
      <div className="relative aspect-[3/4] bg-muted flex flex-col items-center justify-center gap-3 px-6 text-center border border-border/30">
        <p className="text-sm text-foreground/60 max-w-sm">
          {emptyLabel
            ? `No photos are linked to “${emptyLabel}” yet. Images may still be assigned in our catalog — try another color or size.`
            : "No photos available for this product."}
        </p>
      </div>
    );
  }

  const goTo = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < sortedImages.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4">
      {/* Thumbnails */}
      {sortedImages.length > 1 && (
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[600px] pb-2 lg:pb-0">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => goTo(index)}
              className={cn(
                "flex-shrink-0 w-16 h-20 lg:w-20 lg:h-24 overflow-hidden border-2 transition-colors",
                index === currentIndex
                  ? "border-foreground"
                  : "border-transparent hover:border-foreground/30"
              )}
            >
              <img
                src={image.url}
                alt={image.altText || `${productName} ${index + 1}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Main Image */}
      <div className="flex-1 relative">
        <Dialog>
          <DialogTrigger asChild>
            <div className="relative aspect-[3/4] bg-muted overflow-hidden cursor-zoom-in group">
              <AnimatePresence initial={false} custom={direction}>
                <motion.img
                  key={currentIndex}
                  src={currentImage.url}
                  alt={currentImage.altText || productName}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </AnimatePresence>
              
              {/* Zoom Icon */}
              <div className="absolute top-4 right-4 bg-background/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
            <img
              src={currentImage.url}
              alt={currentImage.altText || productName}
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </DialogContent>
        </Dialog>

        {/* Navigation Arrows */}
        {sortedImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 p-2 transition-opacity",
                currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-background"
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === sortedImages.length - 1}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 p-2 transition-opacity",
                currentIndex === sortedImages.length - 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-background"
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots indicator for mobile */}
        {sortedImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 lg:hidden">
            {sortedImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentIndex ? "bg-foreground" : "bg-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
