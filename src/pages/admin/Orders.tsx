import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, Truck } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-100 text-gray-800",
};

const orderStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
const paymentStatuses = ["pending", "paid", "failed", "refunded"];
const fulfillmentStatuses = ["unfulfilled", "fulfilled", "partially_fulfilled"];

const AdminOrders = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Order status updated" });
    },
  });

  const updateFulfillmentMutation = useMutation({
    mutationFn: async ({ id, fulfillmentStatus }: { id: string; fulfillmentStatus: string }) => {
      const { error } = await supabase.from("orders").update({ fulfillment_status: fulfillmentStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Fulfillment status updated" });
    },
  });

  const saveTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!trackingOrderId) return;
      const { error } = await supabase.from("orders").update({
        tracking_number: trackingNumber || null,
        tracking_url: trackingUrl || null,
        fulfillment_status: "fulfilled",
      }).eq("id", trackingOrderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Tracking info saved" });
      setTrackingOrderId(null);
      setTrackingNumber("");
      setTrackingUrl("");
    },
  });

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (paymentFilter !== "all" && o.payment_status !== paymentFilter) return false;
    if (fulfillmentFilter !== "all" && (o as any).fulfillment_status !== fulfillmentFilter) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ["Order #", "Date", "Customer", "Items", "Total", "Payment Method", "Payment Status", "Order Status", "Tracking #"];
    const rows = filtered.map((o) => [
      o.order_number,
      formatDate(o.created_at || ""),
      (o.shipping_address as any)?.full_name || "—",
      o.order_items?.length || 0,
      Number(o.total_amount),
      o.payment_method || "—",
      o.payment_status || "—",
      o.status || "—",
      (o as any).tracking_number || "—",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Orders ({orders.length})</h1>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Order Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {orderStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {paymentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Fulfillment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fulfillment</SelectItem>
            {fulfillmentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border/30 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Tracking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium text-sm">{order.order_number}</TableCell>
                <TableCell className="text-sm">{formatDate(order.created_at || "")}</TableCell>
                <TableCell className="text-sm">{order.order_items?.length || 0} items</TableCell>
                <TableCell className="text-sm">{formatPrice(Number(order.total_amount))}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">{order.payment_method || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <Select value={order.status || "pending"} onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status })}>
                    <SelectTrigger className="w-32 h-8">
                      <Badge className={statusColors[order.status || "pending"]} variant="secondary">
                        {(order.status || "pending").toUpperCase()}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {orderStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={(order as any).fulfillment_status || "unfulfilled"}
                    onValueChange={(fs) => updateFulfillmentMutation.mutate({ id: order.id, fulfillmentStatus: fs })}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fulfillmentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTrackingOrderId(order.id);
                      setTrackingNumber((order as any).tracking_number || "");
                      setTrackingUrl((order as any).tracking_url || "");
                    }}
                  >
                    <Truck className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Tracking Dialog */}
      <Dialog open={!!trackingOrderId} onOpenChange={() => setTrackingOrderId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tracking Info</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>AWB / Tracking Number</Label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" />
            </div>
            <div>
              <Label>Tracking URL</Label>
              <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button onClick={() => saveTrackingMutation.mutate()} disabled={saveTrackingMutation.isPending} className="w-full">
              {saveTrackingMutation.isPending ? "Saving..." : "Save Tracking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
