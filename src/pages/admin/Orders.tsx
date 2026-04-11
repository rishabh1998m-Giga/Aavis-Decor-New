import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Truck, Package, ChevronRight, RefreshCw, Printer, Search, MapPin, Copy,
  Clock, CheckCircle2, XCircle, RotateCcw, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, { className: string; icon: typeof Clock; label: string }> = {
  pending: { className: "bg-amber-100 text-amber-900 border-amber-200", icon: Clock, label: "Pending" },
  confirmed: { className: "bg-sky-100 text-sky-900 border-sky-200", icon: CheckCircle2, label: "Confirmed" },
  shipped: { className: "bg-violet-100 text-violet-900 border-violet-200", icon: Truck, label: "Shipped" },
  delivered: { className: "bg-emerald-100 text-emerald-900 border-emerald-200", icon: CheckCircle2, label: "Delivered" },
  cancelled: { className: "bg-rose-100 text-rose-900 border-rose-200", icon: XCircle, label: "Cancelled" },
  returned: { className: "bg-stone-100 text-stone-900 border-stone-200", icon: RotateCcw, label: "Returned" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyles[status] ?? statusStyles.pending;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium capitalize", s.className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {s.label}
    </span>
  );
};

const orderStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
const paymentStatuses = ["pending", "paid", "failed", "refunded", "pending_payment"];
const fulfillmentStatuses = ["unfulfilled", "fulfilled", "partially_fulfilled"];

type Order = Record<string, unknown>;
type OrdersResponse = {
  rows: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 25;

const AdminOrders = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierDialogOpen, setCourierDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debounce search input by 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter, fulfillmentFilter, debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-orders", page, statusFilter, paymentFilter, fulfillmentFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("payment_status", paymentFilter);
      if (fulfillmentFilter !== "all") params.set("fulfillment_status", fulfillmentFilter);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      return apiJson<OrdersResponse>(`/api/admin/orders?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      await apiJson(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      // Refresh selected order in drawer
      setSelectedOrder((prev) =>
        prev && String(prev.id) === vars.id ? { ...prev, ...vars.patch } : prev
      );
      toast({ title: "Order updated" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const createShipmentMutation = useMutation({
    mutationFn: async (id: string) =>
      apiJson<{ ok: boolean; sr_order_id: number; shipment_id: number }>(
        `/api/admin/orders/${encodeURIComponent(id)}/create-shipment`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder((prev) =>
        prev && String(prev.id) === id
          ? { ...prev, shiprocket_order_id: data.sr_order_id, shiprocket_shipment_id: data.shipment_id, status: "confirmed" }
          : prev
      );
      toast({ title: "Shipment created on Shiprocket" });
    },
    onError: (e) => toast({ title: "Shiprocket error", description: String(e), variant: "destructive" }),
  });

  const { data: couriers = [], isFetching: fetchingCouriers, refetch: fetchCouriers } = useQuery({
    queryKey: ["admin-couriers", selectedOrder?.id],
    queryFn: async () =>
      apiJson<Array<{ courier_company_id: number; courier_name: string; rate: number; etd: string; cod?: boolean }>>(
        `/api/admin/orders/${encodeURIComponent(String(selectedOrder?.id ?? ""))}/couriers`
      ),
    enabled: false,
  });

  const assignAWBMutation = useMutation({
    mutationFn: async ({ id, courierId }: { id: string; courierId: number }) =>
      apiJson<{ ok: boolean; awb: string; courier_name: string }>(
        `/api/admin/orders/${encodeURIComponent(id)}/assign-awb`,
        { method: "POST", body: JSON.stringify({ courier_id: courierId }) }
      ),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder((prev) =>
        prev && String(prev.id) === id
          ? { ...prev, shiprocket_awb: data.awb, shiprocket_courier_name: data.courier_name, status: "shipped", fulfillment_status: "fulfilled" }
          : prev
      );
      setCourierDialogOpen(false);
      toast({ title: `AWB assigned: ${data.awb}` });
    },
    onError: (e) => toast({ title: "AWB error", description: String(e), variant: "destructive" }),
  });

  const generateLabelMutation = useMutation({
    mutationFn: async (id: string) =>
      apiJson<{ ok: boolean; label_url: string }>(
        `/api/admin/orders/${encodeURIComponent(id)}/generate-label`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder((prev) =>
        prev && String(prev.id) === id ? { ...prev, shiprocket_label_url: data.label_url } : prev
      );
      window.open(data.label_url, "_blank");
      toast({ title: "Label ready" });
    },
    onError: (e) => toast({ title: "Label error", description: String(e), variant: "destructive" }),
  });

  const syncTrackingMutation = useMutation({
    mutationFn: async (id: string) =>
      apiJson<{ ok: boolean; current_status: string; tracking_events: unknown[] }>(
        `/api/admin/orders/${encodeURIComponent(id)}/sync-tracking`
      ),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder((prev) =>
        prev && String(prev.id) === id
          ? { ...prev, shiprocket_status: data.current_status, shiprocket_tracking_events: data.tracking_events, shiprocket_last_synced: new Date().toISOString() }
          : prev
      );
      toast({ title: "Tracking synced", description: data.current_status });
    },
    onError: (e) => toast({ title: "Sync error", description: String(e), variant: "destructive" }),
  });

  const exportCSV = () => {
    const headers = ["Order #", "Date", "Customer", "Items", "Total", "Payment", "Status", "SR Status", "AWB"];
    const rows = orders.map((o) => [
      o.order_number,
      formatDate(String(o.created_at || "")),
      (o.shipping_address as Record<string, string>)?.full_name || "—",
      (o.order_items as unknown[])?.length || 0,
      Number(o.total_amount),
      o.payment_method || "—",
      o.status || "—",
      o.shiprocket_status || "—",
      o.shiprocket_awb || "—",
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

  const openOrder = (order: Order) => setSelectedOrder({ ...order });

  const addr = selectedOrder
    ? ((selectedOrder.shipping_address as Record<string, string>) ?? {})
    : {};

  const trackingEvents =
    (selectedOrder?.shiprocket_tracking_events as Array<Record<string, string>> | null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-display">
          Orders <span className="text-foreground/50 text-base font-sans">({total})</span>
        </h1>
        <Button variant="outline" onClick={exportCSV} className="gap-2 shrink-0" aria-label="Export current page as CSV">
          <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>

      {/* Filters + Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-6">
        <div className="relative sm:col-span-2 lg:flex-1 lg:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, AWB, payment id…"
            className="pl-9 h-10"
            aria-label="Search orders"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 lg:w-40" aria-label="Filter by order status"><SelectValue placeholder="Order Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {orderStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-10 lg:w-40" aria-label="Filter by payment status"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {paymentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
          <SelectTrigger className="h-10 lg:w-44" aria-label="Filter by fulfillment status"><SelectValue placeholder="Fulfillment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fulfillment</SelectItem>
            {fulfillmentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table (md and up) */}
      <div className="hidden md:block border border-border/30 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Order #</TableHead>
                <TableHead className="hidden lg:table-cell min-w-[110px]">Date</TableHead>
                <TableHead className="min-w-[140px]">Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden lg:table-cell">Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">SR Status</TableHead>
                <TableHead className="w-10" aria-hidden></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && orders.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-foreground/50">No orders found</TableCell></TableRow>
              )}
              {orders.map((order) => {
                const a = (order.shipping_address as Record<string, string>) ?? {};
                return (
                  <TableRow
                    key={String(order.id)}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => openOrder(order)}
                  >
                    <TableCell className="font-mono text-xs">{String(order.order_number)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-foreground/60">{formatDate(String(order.created_at || ""))}</TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate max-w-[160px]">{a.full_name || "—"}</div>
                      <div className="text-foreground/50 truncate max-w-[160px]">{a.phone || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">{formatPrice(Number(order.total_amount))}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="capitalize text-xs">{String(order.payment_method || "—")}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(order.status || "pending")} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {order.shiprocket_status ? (
                        <span className="text-xs text-foreground/70">{String(order.shiprocket_status)}</span>
                      ) : order.shiprocket_order_id ? (
                        <span className="text-xs text-sky-600">On SR</span>
                      ) : (
                        <span className="text-xs text-foreground/30">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-foreground/30" aria-hidden />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile card list (< md) */}
      <div className="md:hidden space-y-3">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={`msk-${i}`} className="border border-border/30 rounded-md p-4">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
        {!isLoading && orders.length === 0 && (
          <div className="text-center py-12 text-foreground/50 text-sm">No orders found</div>
        )}
        {orders.map((order) => {
          const a = (order.shipping_address as Record<string, string>) ?? {};
          return (
            <button
              key={String(order.id)}
              onClick={() => openOrder(order)}
              className="w-full text-left border border-border/30 rounded-md p-4 hover:bg-muted/30 active:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs truncate">{String(order.order_number)}</p>
                  <p className="text-xs text-foreground/50">{formatDate(String(order.created_at || ""))}</p>
                </div>
                <p className="text-sm font-medium whitespace-nowrap">{formatPrice(Number(order.total_amount))}</p>
              </div>
              <div className="text-xs text-foreground/70 mb-3 truncate">
                {a.full_name || "—"} · {a.phone || "—"}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={String(order.status || "pending")} />
                <Badge variant="outline" className="capitalize text-[10px]">{String(order.payment_method || "—")}</Badge>
                {order.shiprocket_awb != null && (
                  <span className="text-[10px] text-foreground/50 font-mono">AWB {String(order.shiprocket_awb)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
          <p className="text-xs text-foreground/50">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label="Next page"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Drawer */}
      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          {selectedOrder && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="font-mono text-base">{String(selectedOrder.order_number)}</SheetTitle>
                <p className="text-xs text-foreground/50">{formatDate(String(selectedOrder.created_at || ""))}</p>
              </SheetHeader>

              {/* Customer & Address */}
              <section className="mb-6">
                <h3 className="text-xs tracking-widest text-foreground/50 mb-3 flex items-center gap-2"><MapPin className="h-3 w-3" /> CUSTOMER</h3>
                <div className="text-sm space-y-1">
                  <p className="font-medium">{addr.full_name || "—"}</p>
                  <p className="text-foreground/60">{addr.phone || ""}</p>
                  <p className="text-foreground/60 leading-relaxed">
                    {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </section>

              {/* Order Items */}
              <section className="mb-6">
                <h3 className="text-xs tracking-widest text-foreground/50 mb-3 flex items-center gap-2">
                  <Package className="h-3 w-3" /> ITEMS ({(selectedOrder.order_items as unknown[])?.length || 0})
                </h3>
                <div className="space-y-2">
                  {((selectedOrder.order_items as Record<string, unknown>[]) || []).map((item) => (
                    <div key={String(item.id)} className="flex justify-between items-start text-sm gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{String(item.product_name)}</p>
                        <p className="text-xs text-foreground/50">{String(item.variant_info || "")} × {item.quantity}</p>
                      </div>
                      <p className="shrink-0 text-sm">{formatPrice(Number(item.total_price))}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/30 space-y-1 text-sm">
                  <div className="flex justify-between text-foreground/60"><span>Subtotal</span><span>{formatPrice(Number(selectedOrder.subtotal))}</span></div>
                  {Number(selectedOrder.shipping_amount) > 0 && (
                    <div className="flex justify-between text-foreground/60"><span>Shipping</span><span>{formatPrice(Number(selectedOrder.shipping_amount))}</span></div>
                  )}
                  {Number(selectedOrder.cod_fee) > 0 && (
                    <div className="flex justify-between text-foreground/60"><span>COD Fee</span><span>{formatPrice(Number(selectedOrder.cod_fee))}</span></div>
                  )}
                  {Number(selectedOrder.discount_amount) > 0 && (
                    <div className="flex justify-between text-green-600"><span>Discount</span><span>−{formatPrice(Number(selectedOrder.discount_amount))}</span></div>
                  )}
                  <div className="flex justify-between font-medium pt-1 border-t border-border/30"><span>Total</span><span>{formatPrice(Number(selectedOrder.total_amount))}</span></div>
                </div>
              </section>

              {/* Status Controls */}
              <section className="mb-6 space-y-3">
                <h3 className="text-xs tracking-widest text-foreground/50">ORDER STATUS</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-foreground/50 mb-1 block">Order</Label>
                    <Select
                      value={String(selectedOrder.status || "pending")}
                      onValueChange={(s) => updateOrderMutation.mutate({ id: String(selectedOrder.id), patch: { status: s } })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{orderStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-foreground/50 mb-1 block">Payment</Label>
                    <Select
                      value={String(selectedOrder.payment_status || "pending")}
                      onValueChange={(s) => updateOrderMutation.mutate({ id: String(selectedOrder.id), patch: { payment_status: s } })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{paymentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {selectedOrder.payment_method === "upi" && selectedOrder.razorpay_payment_id && (
                    <div className="col-span-2">
                      <Label className="text-xs text-foreground/50 mb-1 block">Razorpay ID</Label>
                      <div className="flex items-center gap-2 bg-muted/40 rounded px-3 py-2">
                        <span className="font-mono text-xs flex-1 truncate">{String(selectedOrder.razorpay_payment_id)}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(String(selectedOrder.razorpay_payment_id))}
                          className="text-foreground/40 hover:text-foreground"
                          title="Copy"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-xs text-foreground/50 mb-1 block">Fulfillment</Label>
                    <Select
                      value={String(selectedOrder.fulfillment_status || "unfulfilled")}
                      onValueChange={(s) => updateOrderMutation.mutate({ id: String(selectedOrder.id), patch: { fulfillment_status: s } })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{fulfillmentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Shiprocket Section */}
              <section className="mb-6 border border-border/30 rounded-md p-4">
                <h3 className="text-xs tracking-widest text-foreground/50 mb-4 flex items-center gap-2">
                  <Truck className="h-3 w-3" /> SHIPROCKET
                </h3>

                {!selectedOrder.shiprocket_order_id && (
                  <Button
                    size="sm"
                    onClick={() => createShipmentMutation.mutate(String(selectedOrder.id))}
                    disabled={createShipmentMutation.isPending}
                    className="w-full"
                  >
                    {createShipmentMutation.isPending ? "Creating…" : "Push to Shiprocket"}
                  </Button>
                )}

                {selectedOrder.shiprocket_order_id && !selectedOrder.shiprocket_awb && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/60">SR Order ID</span>
                      <span className="font-mono">{String(selectedOrder.shiprocket_order_id)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCourierDialogOpen(true);
                        fetchCouriers();
                      }}
                    >
                      Assign Courier & AWB
                    </Button>
                  </div>
                )}

                {selectedOrder.shiprocket_awb && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/60">AWB</span>
                      <span className="font-mono font-medium">{String(selectedOrder.shiprocket_awb)}</span>
                    </div>
                    {selectedOrder.shiprocket_courier_name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground/60">Courier</span>
                        <span>{String(selectedOrder.shiprocket_courier_name)}</span>
                      </div>
                    )}
                    {selectedOrder.shiprocket_status && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground/60">SR Status</span>
                        <Badge variant="secondary" className="text-xs">{String(selectedOrder.shiprocket_status)}</Badge>
                      </div>
                    )}
                    {selectedOrder.shiprocket_last_synced && (
                      <p className="text-xs text-foreground/40">Synced {formatDate(String(selectedOrder.shiprocket_last_synced))}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => syncTrackingMutation.mutate(String(selectedOrder.id))}
                        disabled={syncTrackingMutation.isPending}
                      >
                        <RefreshCw className={cn("h-3 w-3", syncTrackingMutation.isPending && "animate-spin")} />
                        Sync
                      </Button>
                      {selectedOrder.shiprocket_label_url ? (
                        <Button size="sm" variant="outline" className="flex-1 gap-1" asChild>
                          <a href={String(selectedOrder.shiprocket_label_url)} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-3 w-3" /> Label
                          </a>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1"
                          onClick={() => generateLabelMutation.mutate(String(selectedOrder.id))}
                          disabled={generateLabelMutation.isPending}
                        >
                          <Printer className="h-3 w-3" />
                          {generateLabelMutation.isPending ? "Generating…" : "Get Label"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Tracking Events Timeline */}
              {trackingEvents.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-xs tracking-widest text-foreground/50 mb-3">TRACKING HISTORY</h3>
                  <div className="relative pl-4">
                    <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border/40" />
                    {[...trackingEvents].reverse().map((ev, i) => (
                      <div key={i} className="relative mb-4 pl-4">
                        <div className="absolute -left-[1px] top-1.5 w-2 h-2 rounded-full bg-foreground/20 border border-border" />
                        <p className="text-xs font-medium text-foreground">{ev.activity || ev["sr-status-label"] || "—"}</p>
                        {ev.location && <p className="text-xs text-foreground/50">{ev.location}</p>}
                        <p className="text-xs text-foreground/40 mt-0.5">{ev.date}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Courier Picker Dialog */}
      <Dialog open={courierDialogOpen} onOpenChange={setCourierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Courier</DialogTitle>
            <DialogDescription>Choose a courier to assign AWB for this shipment.</DialogDescription>
          </DialogHeader>
          {fetchingCouriers && (
            <p className="text-sm text-foreground/50 text-center py-4">Loading couriers…</p>
          )}
          {!fetchingCouriers && couriers.length === 0 && (
            <p className="text-sm text-foreground/50 text-center py-4">No couriers available for this pincode.</p>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {couriers.map((c) => (
              <button
                key={c.courier_company_id}
                className="w-full text-left border border-border/30 rounded-md p-3 hover:bg-muted/50 transition-colors flex justify-between items-center"
                onClick={() => {
                  if (!selectedOrder) return;
                  assignAWBMutation.mutate({
                    id: String(selectedOrder.id),
                    courierId: c.courier_company_id,
                  });
                }}
                disabled={assignAWBMutation.isPending}
              >
                <div>
                  <p className="text-sm font-medium">{c.courier_name}</p>
                  <p className="text-xs text-foreground/50">ETD: {c.etd}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">₹{c.rate}</p>
                  {c.cod && <p className="text-xs text-foreground/50">COD available</p>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
