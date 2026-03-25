import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ExternalLink } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-100 text-gray-800",
};

const AccountOrders = () => {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () =>
      apiJson<Record<string, unknown>[]>("/api/me/orders"),
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="h-16 w-16 text-foreground/20 mx-auto mb-4" />
        <p className="text-foreground/50 mb-4">You haven't placed any orders yet</p>
        <Button asChild><Link to="/">Start Shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order: Record<string, unknown>) => (
        <div key={String(order.id)} className="border border-border/30 rounded-md p-4">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs text-foreground/50 tracking-widest mb-1">ORDER NUMBER</p>
              <p className="font-mono font-medium text-sm">{String(order.order_number)}</p>
              <p className="text-xs text-foreground/50 mt-1">{formatDate(String(order.created_at || ""))}</p>
            </div>
            <div className="text-right">
              <Badge className={statusColors[String(order.status)] || "bg-gray-100 text-gray-800"}>
                {String(order.status)}
              </Badge>
              <p className="text-sm font-medium mt-2">{formatPrice(Number(order.total_amount))}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-border/30">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/order-tracking/${order.order_number}`} className="gap-2">
                <ExternalLink className="h-3 w-3" /> Track
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AccountOrders;
