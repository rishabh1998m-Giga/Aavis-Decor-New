import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import CollectionRulePreview from "@/components/admin/CollectionRulePreview";

const AdminCollections = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    title: "", slug: "", description: "", type: "manual", rules: "", is_active: true,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["admin-collections"],
    queryFn: async () => apiJson<Record<string, unknown>[]>("/api/admin/collections"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        description: form.description || null,
        type: form.type,
        rules: form.type === "automatic" && form.rules ? JSON.parse(form.rules) : null,
        is_active: form.is_active,
        sort_order: editing ? (editing.sort_order as number) ?? 0 : collections.length,
      };
      if (editing) {
        await apiJson(`/api/admin/collections/${encodeURIComponent(String(editing.id))}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson("/api/admin/collections", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      toast({ title: editing ? "Collection updated" : "Collection created" });
      setIsDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/api/admin/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      toast({ title: "Collection deleted" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ title: "", slug: "", description: "", type: "manual", rules: "", is_active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (c: Record<string, unknown>) => {
    setEditing(c);
    setForm({
      title: String(c.title),
      slug: String(c.slug),
      description: String(c.description || ""),
      type: String(c.type),
      rules: c.rules ? JSON.stringify(c.rules, null, 2) : "",
      is_active: Boolean(c.is_active),
    });
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Collections</h1>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Collection</Button>
      </div>

      <div className="border border-border/30 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((c: Record<string, unknown>) => (
              <TableRow key={String(c.id)}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell><Badge variant="outline">{String(c.type)}</Badge></TableCell>
                <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openEdit(c)} className="p-2 hover:bg-muted rounded"><Edit2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => deleteMutation.mutate(String(c.id))} className="p-2 hover:bg-muted rounded text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Collection" : "Add Collection"}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">Automatic (tags)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "automatic" && (
              <div>
                <Label>Rules (JSON)</Label>
                <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={4} placeholder='{"tags":["floral"]}' />
                <CollectionRulePreview rulesJson={form.rules} />
              </div>
            )}
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

export default AdminCollections;
