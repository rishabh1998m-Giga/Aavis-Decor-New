import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import StoreLayout from "@/components/layout/StoreLayout";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package, CheckCircle, Truck, Home, ExternalLink, Search, Clock,
} from "lucide-react";

const statusSteps = [
  { key: "pending", icon: Clock, label: "Placed" },
  { key: "confirmed", icon: CheckCircle, label: "Confirmed" },
  { key: "shipped", icon: Truck, label: "Shipped" },
  { key: "delivered", icon: Home, label: "Delivered" },
];

const statusIndex: Record<string, number> = {
  pending: 0, confirmed: 1, shipped: 2, delivered: 3,
};

const OrderTracking = () => {
  const { orderNumber: paramOrderNumber } = useParams<{ orderNumber: string }>();
  const [searchInput, setSearchInput] = useState("");
  const [orderNumber, setOrderNumber] = useState(paramOrderNumber || "");

  const { data: order, isLoading } = useQuery({
    queryKey: ["track-order", orderNumber],
    queryFn: async () => {
      if (!orderNumber) return null;
      try {
        return await apiJson<Record<string, unknown> & { order_items?: Record<string, unknown>[] }>(
          `/api/orders/by-number/${encodeURIComponent(orderNumber)}`
        );
      } catch {
        return null;
      }
    },
    enabled: !!orderNumber,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setOrderNumber(searchInput.trim());
  };

  const currentStepIndex = statusIndex[String(order?.status || "pending")] ?? 0;

  return (
    <StoreLayout>
      <div className="pt-32 pb-20 min-h-screen">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl mb-2 text-center">Track Your Order</h1>
          <p className="text-foreground/60 text-center mb-8">Enter your order number to see the latest status.</p>

          <form onSubmit={handleSearch} className="flex gap-3 mb-10">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. LNC-XXXX-XXXX"
              className="h-12"
            />
            <Button type="submit" className="h-12 px-6 gap-2">
              <Search className="h-4 w-4" /> Track
            </Button>
          </form>

          {isLoading && (
            <div className="text-center py-12 text-foreground/50">Looking up order...</div>
          )}

          {!isLoading && orderNumber && !order && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/60">No order found with number <span className="font-mono font-medium text-foreground">{orderNumber}</span></p>
            </div>
          )}

          {order && (
            <div className="space-y-6">
              <div className="flex items-start justify-between border border-border/30 rounded-md p-5">
                <div>
                  <p className="text-xs text-foreground/50 tracking-widest mb-1">ORDER NUMBER</p>
                  <p className="font-mono font-medium">{order.order_number}</p>
                  <p className="text-xs text-foreground/50 mt-1">{formatDate(String(order.created_at || ""))}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="capitalize">{String(order.status)}</Badge>
                  <p className="text-sm font-medium mt-2">{formatPrice(Number(order.total_amount))}</p>
                </div>
              </div>

              <div className="border border-border/30 rounded-md p-6">
                <h3 className="text-xs tracking-widest text-foreground/70 mb-6">ORDER STATUS</h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-4 left-6 right-6 h-0.5 bg-border/40" />
                  <div
                    className="absolute top-4 left-6 h-0.5 bg-foreground transition-all duration-500"
                    style={{ width: `calc(${(currentStepIndex / (statusSteps.length - 1)) * 100}% - 48px)` }}
                  />
                  {statusSteps.map((step, i) => {
                    const isActive = i <= currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-2 relative z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isActive ? "bg-foreground text-background" : "bg-muted text-foreground/30"
                        } ${isCurrent ? "ring-2 ring-foreground/20 ring-offset-2 ring-offset-background" : ""}`}>
                          <step.icon className="h-4 w-4" />
                        </div>
                        <span className={`text-[11px] font-medium ${isActive ? "text-foreground" : "text-foreground/40"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {order.status === "cancelled" && (
                  <div className="mt-6 p-3 bg-destructive/10 rounded text-sm text-destructive text-center">
                    This order has been cancelled.
                  </div>
                )}
              </div>

              {order.tracking_number && (
                <div className="border border-border/30 rounded-md p-5">
                  <h3 className="text-xs tracking-widest text-foreground/70 mb-3">SHIPMENT TRACKING</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-foreground/50">AWB / Tracking Number</p>
                      <p className="font-mono font-medium text-sm">{String(order.tracking_number)}</p>
                    </div>
                    {order.tracking_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={String(order.tracking_url)} target="_blank" rel="noopener noreferrer" className="gap-2">
                          Track on Courier <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-border/30 rounded-md p-5">
                <h3 className="text-xs tracking-widest text-foreground/70 mb-4">ITEMS ({(order.order_items as unknown[])?.length || 0})</h3>
                <div className="space-y-3">
                  {((order.order_items as Record<string, unknown>[]) || []).map((item) => (
                    <div key={String(item.id)} className="flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-foreground/50">{item.variant_info} × {item.quantity}</p>
                      </div>
                      <p className="font-medium">{formatPrice(Number(item.total_price))}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border/30 rounded-md p-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-foreground/60">Subtotal</span><span>{formatPrice(Number(order.subtotal))}</span></div>
                {Number(order.shipping_amount) > 0 && (
                  <div className="flex justify-between"><span className="text-foreground/60">Shipping</span><span>{formatPrice(Number(order.shipping_amount))}</span></div>
                )}
                {Number(order.cod_fee) > 0 && (
                  <div className="flex justify-between"><span className="text-foreground/60">COD Fee</span><span>{formatPrice(Number(order.cod_fee))}</span></div>
                )}
                {Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600"><span>Discount ({order.discount_code})</span><span>-{formatPrice(Number(order.discount_amount))}</span></div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t border-border/30">
                  <span>Total</span><span>{formatPrice(Number(order.total_amount))}</span>
                </div>
              </div>

              <div className="text-center">
                <Button variant="outline" asChild>
                  <Link to="/">Continue Shopping</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  );
};

export default OrderTracking;