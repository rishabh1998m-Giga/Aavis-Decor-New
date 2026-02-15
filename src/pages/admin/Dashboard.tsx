import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { DollarSign, Package, ShoppingCart, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [ordersRes, productsRes, lowStockRes, customersRes] = await Promise.all([
        supabase.from("orders").select("id, total_amount, status, payment_method, payment_status, created_at"),
        supabase.from("products").select("id", { count: "exact" }),
        supabase.from("product_variants").select("id, product_id, stock_quantity, sku, products(name)").lte("stock_quantity", 5),
        supabase.from("profiles").select("id", { count: "exact" }),
      ]);

      const orders = ordersRes.data || [];
      const totalRevenue = orders
        .filter((o) => o.payment_status === "paid" || o.payment_method === "cod")
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      const pendingOrders = orders.filter((o) => o.status === "pending").length;
      const codOrders = orders.filter((o) => o.payment_method === "cod").length;

      // Recent 7 days revenue
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentRevenue = orders
        .filter((o) => new Date(o.created_at!) > sevenDaysAgo)
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      // Build daily revenue for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { revenue: 0, orders: 0 };
      }
      orders.forEach((o) => {
        const key = (o.created_at || "").slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].revenue += Number(o.total_amount);
          dailyMap[key].orders += 1;
        }
      });
      const dailyData = Object.entries(dailyMap).map(([date, v]) => ({
        date: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        revenue: Math.round(v.revenue),
        orders: v.orders,
      }));

      return {
        totalOrders: orders.length,
        totalRevenue,
        totalProducts: productsRes.count || 0,
        totalCustomers: customersRes.count || 0,
        lowStockItems: (lowStockRes.data || []) as any[],
        pendingOrders,
        codOrders,
        recentRevenue,
        recentOrders: orders.slice(0, 10),
        dailyData,
      };
    },
  });

  const chartConfig = useMemo(() => ({
    revenue: { label: "Revenue", color: "hsl(var(--accent))" },
    orders: { label: "Orders", color: "hsl(var(--primary))" },
  }), []);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
  };

  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs tracking-widest text-foreground/60">REVENUE</CardTitle>
            <DollarSign className="h-4 w-4 text-foreground/40" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display">{formatPrice(stats?.totalRevenue || 0)}</p>
            <p className="text-xs text-foreground/50 mt-1">Last 7d: {formatPrice(stats?.recentRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs tracking-widest text-foreground/60">ORDERS</CardTitle>
            <ShoppingCart className="h-4 w-4 text-foreground/40" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display">{stats?.totalOrders || 0}</p>
            <p className="text-xs text-foreground/50 mt-1">{stats?.pendingOrders || 0} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs tracking-widest text-foreground/60">CUSTOMERS</CardTitle>
            <Users className="h-4 w-4 text-foreground/40" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display">{stats?.totalCustomers || 0}</p>
            <p className="text-xs text-foreground/50 mt-1">{stats?.codOrders || 0} COD orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs tracking-widest text-foreground/60">LOW STOCK</CardTitle>
            <AlertTriangle className="h-4 w-4 text-foreground/40" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display">{stats?.lowStockItems.length || 0}</p>
            <p className="text-xs text-foreground/50 mt-1">{stats?.totalProducts || 0} total products</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {stats?.dailyData && stats.dailyData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Revenue (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Orders (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Alerts - Enhanced with product names */}
      {stats?.lowStockItems && stats.lowStockItems.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.lowStockItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground/70 font-mono text-xs">{item.sku}</span>
                    <span className="text-foreground/50 text-xs">{(item as any).products?.name || "—"}</span>
                  </div>
                  <Badge variant={item.stock_quantity === 0 ? "destructive" : "outline"} className={item.stock_quantity > 0 ? "border-yellow-500 text-yellow-600" : ""}>
                    {item.stock_quantity === 0 ? "Out of stock" : `${item.stock_quantity} left`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      {stats?.recentOrders && stats.recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Package className="h-5 w-5" /> Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentOrders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"} variant="secondary">
                      {order.status?.toUpperCase()}
                    </Badge>
                    <span className="text-foreground/50">{formatDate(order.created_at)}</span>
                  </div>
                  <span className="font-medium">{formatPrice(Number(order.total_amount))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
