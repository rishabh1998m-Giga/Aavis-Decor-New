import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { buildCartLineId, lineEmbeddedGst } from "@/lib/cartLine";

export interface CartItem {
  lineId: string;
  productId: string;
  productSlug?: string;
  variantId: string;
  name: string;
  variantInfo: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  imageUrl: string;
  sku: string;
  maxStock: number;
  /** GST % embedded in inclusive line price; default 18 for legacy stored carts. */
  gstRate: number;
  customCurtainSize?: string;
}

export type CartItemInput = Omit<CartItem, "quantity" | "lineId"> & { lineId?: string };

function normalizeStoredCartItem(raw: Record<string, unknown>): CartItem | null {
  const variantId = typeof raw.variantId === "string" ? raw.variantId : null;
  if (!variantId) return null;

  const custom =
    typeof raw.customCurtainSize === "string" ? raw.customCurtainSize.trim().slice(0, 200) : undefined;
  const lineId =
    typeof raw.lineId === "string" && raw.lineId.length > 0
      ? raw.lineId
      : buildCartLineId(variantId, custom);

  const gstRate =
    typeof raw.gstRate === "number" && Number.isFinite(raw.gstRate) ? raw.gstRate : 18;

  return {
    lineId,
    productId: String(raw.productId ?? ""),
    productSlug: typeof raw.productSlug === "string" ? raw.productSlug : undefined,
    variantId,
    name: String(raw.name ?? ""),
    variantInfo: String(raw.variantInfo ?? "Default"),
    price: Number(raw.price) || 0,
    compareAtPrice: raw.compareAtPrice != null ? Number(raw.compareAtPrice) : undefined,
    quantity: Math.max(1, Number(raw.quantity) || 1),
    imageUrl: String(raw.imageUrl ?? "/placeholder.svg"),
    sku: String(raw.sku ?? ""),
    maxStock: Math.max(0, Number(raw.maxStock) ?? 0),
    gstRate,
    customCurtainSize: custom || undefined,
  };
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItemInput, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  embeddedGstTotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "aavisdecor_cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown[];
        if (Array.isArray(parsed)) {
          const next = parsed
            .map((row) =>
              row && typeof row === "object" ? normalizeStoredCartItem(row as Record<string, unknown>) : null
            )
            .filter((x): x is CartItem => x != null);
          setItems(next);
        }
      } catch (e) {
        console.error("Failed to parse cart from storage:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItemInput, quantity = 1) => {
    const custom = item.customCurtainSize?.trim().slice(0, 200);
    const lineId = item.lineId ?? buildCartLineId(item.variantId, custom);
    const gstRate = typeof item.gstRate === "number" && Number.isFinite(item.gstRate) ? item.gstRate : 18;
    const payload: Omit<CartItem, "quantity"> = {
      ...item,
      lineId,
      gstRate,
      customCurtainSize: custom || undefined,
    };

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.lineId === lineId);

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQuantity = Math.min(
          updated[existingIndex].quantity + quantity,
          item.maxStock
        );
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQuantity };
        return updated;
      }

      return [...prev, { ...payload, quantity: Math.min(quantity, item.maxStock) }];
    });
    setIsOpen(true);
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(lineId);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.lineId === lineId
          ? { ...item, quantity: Math.min(quantity, item.maxStock) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const embeddedGstTotal = items.reduce(
    (sum, item) => sum + lineEmbeddedGst(item.price * item.quantity, item.gstRate),
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        embeddedGstTotal,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
