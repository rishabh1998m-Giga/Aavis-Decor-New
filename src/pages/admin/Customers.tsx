import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { formatDate } from "@/lib/formatters";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const AdminCustomers = () => {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () =>
      apiJson<
        {
          id: string;
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string | null;
          orderCount: number;
        }[]
      >("/api/admin/customers"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Customers ({isLoading ? "…" : customers.length})</h1>
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
              {customers.map((c) => (
                <TableRow key={String(c.id)}>
                  <TableCell className="font-medium">{String(c.full_name || "—")}</TableCell>
                  <TableCell className="text-sm">{String(c.phone || "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.orderCount} orders</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(String(c.created_at || ""))}</TableCell>
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
