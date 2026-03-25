import { Link } from "react-router-dom";
import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import PincodeChecker from "@/components/shared/PincodeChecker";
import { Minus, Plus, X, ShoppingBag, ChevronRight } from "lucide-react";

const Cart = () => {
  const { items, removeItem, updateQuantity, subtotal, itemCount } = useCart();

  // Estimate shipping (free above 999)
  const shippingEstimate = subtotal >= 999 ? 0 : 99;
  const total = subtotal + shippingEstimate;

  if (items.length === 0) {
    return (
      <StoreLayout>
        <PageMeta title="Shopping Bag" description="Your Aavis Decor shopping bag is empty. Continue shopping for pillow covers, curtains, and home textiles." canonical="/cart" noIndex />
        <div className="pt-32 pb-20 min-h-screen">
          <div className="container max-w-lg text-center">
            <ShoppingBag className="h-20 w-20 text-foreground/20 mx-auto mb-6" />
            <h1 className="font-display text-2xl mb-3">Your bag is empty</h1>
            <p className="text-foreground/50 mb-8">
              Looks like you haven't added anything to your bag yet.
            </p>
            <Button asChild>
              <Link to="/">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <PageMeta title="Shopping Bag" description="Review your Aavis Decor cart. Free shipping on orders above ₹999." canonical="/cart" noIndex />
      <div className="pt-32 pb-20">
        {/* Breadcrumb */}
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-xs text-foreground/50">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Shopping Bag</span>
          </nav>
        </div>

        <div className="container">
          <h1 className="font-display text-3xl mb-8">
            Shopping Bag ({itemCount})
          </h1>

          <div className="grid lg:grid-cols-3 gap-10">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex gap-6 p-4 border border-border/30 rounded-md"
                >
                  {/* Image */}
                  <Link
                    to={`/product/${item.productSlug ?? item.productId}`}
                    className="w-28 h-36 flex-shrink-0 bg-muted overflow-hidden"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link
                          to={`/product/${item.productSlug ?? item.productId}`}
                          className="font-display text-lg hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-foreground/50 mt-1">
                          {item.variantInfo}
                        </p>
                        <p className="text-xs text-foreground/40 mt-1">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.lineId)}
                        className="text-foreground/40 hover:text-foreground p-2 self-start"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between mt-auto pt-4">
                      {/* Quantity */}
                      <div className="flex items-center border border-border/50">
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity - 1)
                          }
                          className="p-2 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity + 1)
                          }
                          className="p-2 hover:bg-muted transition-colors"
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-lg font-medium">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        {item.compareAtPrice && (
                          <p className="text-sm text-foreground/40 line-through">
                            {formatPrice(item.compareAtPrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-32 border border-border/30 rounded-md p-6 space-y-6">
                <h2 className="font-display text-lg">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground/70">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/70">Shipping</span>
                    <span>
                      {shippingEstimate === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        formatPrice(shippingEstimate)
                      )}
                    </span>
                  </div>
                  {shippingEstimate > 0 && (
                    <p className="text-xs text-foreground/50">
                      Free shipping on orders above ₹999
                    </p>
                  )}
                </div>

                <div className="border-t border-border/30 pt-4">
                  <div className="flex justify-between text-lg font-medium">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-1">
                    Including GST
                  </p>
                </div>

                <Button
                  asChild
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest"
                >
                  <Link to="/checkout">PROCEED TO CHECKOUT</Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full text-xs tracking-widest"
                >
                  <Link to="/">CONTINUE SHOPPING</Link>
                </Button>

                {/* Pincode Checker */}
                <div className="border-t border-border/30 pt-6">
                  <h3 className="text-xs tracking-widest text-foreground/70 mb-3">
                    CHECK DELIVERY
                  </h3>
                  <PincodeChecker />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default Cart;
