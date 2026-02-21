
## Replace Hero Section Background Image

Replace the current hero background image with the uploaded photo of colorful pillow covers and home textiles.

### Changes

1. **Copy the uploaded image** to `src/assets/hero-home.jpg` (replacing the existing hero image)

2. **No code changes needed** -- the `HeroBanner.tsx` component already imports from `@/assets/hero-home.jpg`, so swapping the file is all that's required.

### Technical Details

- File to copy: `user-uploads://Gemini_Generated_Image_bvfijsbvfijsbvfi.png` -> `src/assets/hero-home.jpg`
- The existing import in `HeroBanner.tsx` (`import heroImage from "@/assets/hero-home.jpg"`) will automatically pick up the new image.
- The gradient overlays already in place will ensure text remains readable over the brighter, more colorful image.
