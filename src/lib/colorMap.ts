/**
 * Maps color names to hex values for swatch display.
 * CSS color names like "dark teal" don't work with backgroundColor.
 */
const COLOR_MAP: Record<string, string> = {
  "dark teal": "#2F4F4F",
  "deep teal": "#006D5B",
  "light grey": "#D3D3D3",
  "light gray": "#D3D3D3",
  "dark grey": "#4A4A4A",
  "dark gray": "#4A4A4A",
  "mist blue": "#B0C4DE",
  "misty blue": "#B0C4DE",
  "light violet": "#D8BFD8",
  "light brown": "#A0522D",
  "warm beige": "#DEB887",
  "mist grey": "#B0B0B0",
  "mist gray": "#B0B0B0",
  "light pink": "#FFB6C1",
  ivory: "#FFFFF0",
  beige: "#F5F5DC",
  grey: "#808080",
  gray: "#808080",
  brown: "#8B4513",
  white: "#FFFFFF",
  black: "#000000",
  navy: "#000080",
  teal: "#008080",
  coral: "#FF7F50",
  blue: "#0000FF",
  red: "#FF0000",
  green: "#008000",
  yellow: "#FFFF00",
  orange: "#FFA500",
  purple: "#800080",
  pink: "#FFC0CB",
  gold: "#FFD700",
  silver: "#C0C0C0",
  cream: "#FFFDD0",
  charcoal: "#36454F",
  olive: "#808000",
  burgundy: "#800020",
  maroon: "#800000",
  mustard: "#FFDB58",
  sage: "#9DC183",
  mint: "#98FF98",
  lavender: "#E6E6FA",
  peach: "#FFCBA4",
  rust: "#B7410E",
  terracotta: "#E2725B",
  offwhite: "#FAF9F6",
  "off white": "#FAF9F6",
  "off-white": "#FAF9F6",
};

/**
 * Returns hex color for a color name, or null if not found.
 * Tries exact match first, then lowercase normalized match.
 */
export function getColorHex(color: string | null | undefined): string | null {
  if (!color || typeof color !== "string") return null;
  const normalized = color.trim().toLowerCase();
  if (!normalized) return null;
  return COLOR_MAP[normalized] ?? null;
}

/**
 * Returns a valid CSS color for swatch background.
 * Uses hex from map if available, otherwise tries the raw value as CSS color.
 */
export function getColorForSwatch(color: string | null | undefined): string {
  const hex = getColorHex(color);
  if (hex) return hex;
  if (color && /^#[0-9A-Fa-f]{3,8}$/.test(color)) return color;
  if (color && /^rgb\(|^rgba\(|^hsl\(/.test(color)) return color;
  return "#E5E5E5";
}
