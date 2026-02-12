import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatters";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const AdminCustomers = () => {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get order counts per user
      const userIds = (profiles || []).map((p) => p.user_id);
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, id")
        .in("user_id", userIds);

      const orderCounts = new Map<string, number>();
      (orders || []).forEach((o) => {
        orderCounts.set(o.user_id!, (orderCounts.get(o.user_id!) || 0) + 1);
      });

      return (profiles || []).map((p) => ({
        ...p,
        orderCount: orderCounts.get(p.user_id) || 0,
      }));
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Customers ({customers.length})</h1>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-16 w-16 text-foreground/20 mx-auto mb-4" />
          <p className="text-foreground/50">No customers yet</p>
        </div>
      ) : (
        <div className="border border-border/30 rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.orderCount} orders</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.created_at || "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
