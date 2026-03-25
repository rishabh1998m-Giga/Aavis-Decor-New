import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";

const CartDrawer = () => {
  const { items, removeItem, updateQuantity, subtotal, itemCount, isOpen, setIsOpen } =
    useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg font-display">
            <ShoppingBag className="h-5 w-5" />
            Shopping Bag ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <ShoppingBag className="h-16 w-16 text-foreground/20 mb-4" />
            <h3 className="font-display text-lg mb-2">Your bag is empty</h3>
            <p className="text-foreground/50 text-sm mb-6">
              Looks like you haven't added anything yet
            </p>
            <Button asChild onClick={() => setIsOpen(false)}>
              <Link to="/">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex gap-4 p-4 border border-border/30 rounded-md"
                >
                  {/* Image */}
                  <Link
                    to={`/product/${item.productSlug ?? item.productId}`}
                    onClick={() => setIsOpen(false)}
                    className="w-20 h-24 flex-shrink-0 bg-muted overflow-hidden"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <div>
                        <Link
                          to={`/product/${item.productSlug ?? item.productId}`}
                          onClick={() => setIsOpen(false)}
                          className="font-display text-sm hover:underline line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-foreground/50 mt-0.5">
                          {item.variantInfo}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.lineId)}
                        className="text-foreground/40 hover:text-foreground p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between mt-3">
                      {/* Quantity */}
                      <div className="flex items-center border border-border/50">
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity - 1)
                          }
                          className="p-1.5 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity + 1)
                          }
                          className="p-1.5 hover:bg-muted transition-colors"
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        {item.compareAtPrice && (
                          <p className="text-xs text-foreground/40 line-through">
                            {formatPrice(item.compareAtPrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border/30 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Subtotal</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-foreground/50">
                Shipping & taxes calculated at checkout
              </p>
              <div className="grid gap-2">
                <Button
                  asChild
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest"
                >
                  <Link to="/checkout" onClick={() => setIsOpen(false)}>
                    PROCEED TO CHECKOUT
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-12 text-xs tracking-widest"
                >
                  <Link to="/cart" onClick={() => setIsOpen(false)}>
                    VIEW BAG
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
