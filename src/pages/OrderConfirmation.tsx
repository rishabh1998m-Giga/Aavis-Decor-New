import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StoreLayout from "@/components/layout/StoreLayout";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, Truck, Home } from "lucide-react";

const OrderConfirmation = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();

  const { data: order } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber || "")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orderNumber,
  });

  return (
    <StoreLayout>
      <div className="pt-32 pb-20 min-h-screen">
        <div className="container max-w-lg text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="font-display text-3xl mb-3">Thank You!</h1>
          <p className="text-foreground/60 mb-2">Your order has been placed successfully.</p>
          <p className="text-sm font-medium mb-8">
            Order Number: <span className="text-foreground">{orderNumber}</span>
          </p>

          {order && (
            <div className="border border-border/30 rounded-md p-6 text-left mb-8 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Date</span>
                <span>{formatDate(order.created_at || new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Payment</span>
                <span className="capitalize">{order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Total</span>
                <span className="font-medium">{formatPrice(Number(order.total_amount))}</span>
              </div>
              
              {/* Status Timeline */}
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-xs tracking-widest text-foreground/70 mb-4">ORDER STATUS</h3>
                <div className="flex items-center justify-between">
                  {[
                    { icon: Package, label: "Placed", active: true },
                    { icon: CheckCircle, label: "Confirmed", active: false },
                    { icon: Truck, label: "Shipped", active: false },
                    { icon: Home, label: "Delivered", active: false },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <step.icon
                        className={`h-5 w-5 ${step.active ? "text-green-500" : "text-foreground/20"}`}
                      />
                      <span className={`text-[10px] ${step.active ? "text-foreground" : "text-foreground/40"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Button asChild variant="outline">
              <Link to={`/order-tracking/${orderNumber}`}>Track Order</Link>
            </Button>
            <Button asChild>
              <Link to="/">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default OrderConfirmation;
