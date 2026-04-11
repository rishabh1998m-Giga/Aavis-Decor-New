import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { ProductImage } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < sortedImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const fadeVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
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
                "flex-shrink-0 w-16 h-20 lg:w-20 lg:h-24 overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60",
                index === currentIndex
                  ? "border-foreground"
                  : "border-transparent hover:border-foreground/30"
              )}
              aria-label={`View image ${index + 1} of ${sortedImages.length}`}
              aria-current={index === currentIndex ? "true" : undefined}
            >
              <img
                src={image.url}
                alt={image.altText || `${productName} — view ${index + 1}`}
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
            <div className="relative w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[480px] max-h-[min(88vh,920px)] flex items-center justify-center bg-muted overflow-hidden cursor-zoom-in group py-2">
              <AnimatePresence initial={false} mode="wait">
                <motion.img
                  key={currentIndex}
                  src={currentImage.url}
                  alt={currentImage.altText || productName}
                  variants={fadeVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ opacity: { duration: 0.22 } }}
                  className="w-full h-auto max-h-[min(88vh,920px)] object-contain object-center mx-auto"
                />
              </AnimatePresence>

              {/* Zoom Icon */}
              <div className="absolute top-4 right-4 bg-background/90 p-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm shadow-sm z-10">
                <ZoomIn className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </DialogTrigger>

          <DialogContent
            className={cn(
              "max-w-[min(100vw-1rem,56rem)] p-3 sm:p-4 gap-0",
              "bg-zinc-950/95 border border-white/15 shadow-2xl",
              "[&>button]:absolute [&>button]:right-3 [&>button]:top-3 [&>button]:z-[60]",
              "[&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full",
              "[&>button]:bg-white [&>button]:text-zinc-900 [&>button]:opacity-100",
              "[&>button]:shadow-lg [&>button]:ring-2 [&>button]:ring-white/30",
              "[&>button]:hover:bg-white [&>button]:hover:opacity-95"
            )}
          >
            <DialogTitle className="sr-only">
              {currentImage.altText || `${productName} — enlarged image`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full-size product photo. Use the close button to exit.
            </DialogDescription>
            <div className="mt-8 flex max-h-[85vh] w-full items-center justify-center overflow-auto rounded-sm bg-black/40 p-2">
              <img
                src={currentImage.url}
                alt={currentImage.altText || productName}
                className="max-h-[min(80vh,900px)] w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Navigation Arrows */}
        {sortedImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              aria-label="Previous image"
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 p-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm",
                currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-background"
              )}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === sortedImages.length - 1}
              aria-label="Next image"
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 p-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm",
                currentIndex === sortedImages.length - 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-background"
              )}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
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
                aria-label={`Go to image ${index + 1}`}
                aria-current={index === currentIndex ? "true" : undefined}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60",
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
