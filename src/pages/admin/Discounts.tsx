import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";

const AdminDiscounts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: "", type: "percentage", value: "", min_cart_value: "", max_uses: "", expires_at: "", is_active: true,
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["admin-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase(),
        type: form.type,
        value: Number(form.value),
        min_cart_value: form.min_cart_value ? Number(form.min_cart_value) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("discounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discounts"] });
      toast({ title: editing ? "Discount updated" : "Discount created" });
      setIsDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discounts"] });
      toast({ title: "Discount deleted" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("discounts").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-discounts"] }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ code: "", type: "percentage", value: "", min_cart_value: "", max_uses: "", expires_at: "", is_active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      code: d.code, type: d.type, value: String(d.value),
      min_cart_value: d.min_cart_value ? String(d.min_cart_value) : "",
      max_uses: d.max_uses ? String(d.max_uses) : "",
      expires_at: d.expires_at ? d.expires_at.slice(0, 10) : "",
      is_active: d.is_active,
    });
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Discounts</h1>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Discount</Button>
      </div>

      <div className="border border-border/30 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min Cart</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono font-medium">{d.code}</TableCell>
                <TableCell><Badge variant="outline">{d.type}</Badge></TableCell>
                <TableCell>{d.type === "percentage" ? `${d.value}%` : formatPrice(Number(d.value))}</TableCell>
                <TableCell>{d.min_cart_value ? formatPrice(Number(d.min_cart_value)) : "—"}</TableCell>
                <TableCell>{d.usage_count}{d.max_uses ? `/${d.max_uses}` : ""}</TableCell>
                <TableCell>{d.expires_at ? formatDate(d.expires_at) : "—"}</TableCell>
                <TableCell>
                  <Switch checked={d.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: d.id, active: v })} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(d)} className="p-2 hover:bg-muted rounded"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteMutation.mutate(d.id)} className="p-2 hover:bg-muted rounded text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Discount" : "Add Discount"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="SUMMER20" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Min Cart Value (₹)</Label><Input type="number" value={form.min_cart_value} onChange={(e) => setForm({ ...form, min_cart_value: e.target.value })} /></div>
              <div><Label>Max Uses</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
            </div>
            <div><Label>Expires At</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
            </label>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscounts;
