import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { formatPrice } from "@/lib/formatters";
import { useCategories } from "@/hooks/useProducts";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit2, Trash2, Upload, X, ImagePlus, Loader2, Tags } from "lucide-react";
import BulkTagUpdate from "@/components/admin/BulkTagUpdate";

interface VariantForm {
  id?: string;
  sku: string;
  color: string;
  size: string;
  price: string;
  compare_at_price: string;
  stock_quantity: string;
}

const emptyVariant: VariantForm = {
  sku: "", color: "", size: "", price: "", compare_at_price: "", stock_quantity: "0",
};

const AdminProducts = () => {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Record<string, unknown> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useCategories();
  const { uploadMultiple, uploading: imageUploading } = useImageUpload();
  const [productImages, setProductImages] = useState<{ id?: string; url: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkTagOpen, setIsBulkTagOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "", slug: "", description: "", short_description: "",
    base_price: "", compare_at_price: "", design_name: "",
    category_id: "", fabric: "", dimensions: "", care_instructions: "",
    tags: "", is_featured: false, is_active: true,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => apiJson<Record<string, unknown>[]>("/api/admin/products"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product deleted" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiJson("/api/admin/products/upsert", {
        method: "POST",
        body: JSON.stringify({
          editingId: editingProduct ? editingProduct.id : null,
          product: { ...formData },
          variants,
          images: productImages,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: editingProduct ? "Product updated" : "Product created" });
      setIsDialogOpen(false);
      setEditingProduct(null);
    },
  });

  const filteredProducts = products.filter(
    (p: Record<string, unknown>) =>
      String(p.name).toLowerCase().includes(search.toLowerCase()) ||
      String(p.design_name || "").toLowerCase().includes(search.toLowerCase()) ||
      ((p.product_variants as Record<string, unknown>[]) || []).some((v: Record<string, unknown>) =>
        String(v.sku).toLowerCase().includes(search.toLowerCase())
      )
  );

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormData({
      name: "", slug: "", description: "", short_description: "",
      base_price: "", compare_at_price: "", design_name: "",
      category_id: "", fabric: "", dimensions: "", care_instructions: "",
      tags: "", is_featured: false, is_active: true,
    });
    setVariants([{ ...emptyVariant }]);
    setProductImages([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = async (product: Record<string, unknown>) => {
    setEditingProduct(product);
    setFormData({
      name: String(product.name),
      slug: String(product.slug),
      description: String(product.description || ""),
      short_description: String(product.short_description || ""),
      base_price: String(product.base_price),
      compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
      design_name: String(product.design_name || ""),
      category_id: String(product.category_id || ""),
      fabric: String(product.fabric || ""),
      dimensions: String(product.dimensions || ""),
      care_instructions: String(product.care_instructions || ""),
      tags: (product.tags as string[])?.join(", ") || "",
      is_featured: Boolean(product.is_featured),
      is_active: Boolean(product.is_active),
    });
    const pv = (product.product_variants as Record<string, unknown>[]) || [];
    setVariants(
      pv.map((v) => ({
        id: v.id as string,
        sku: String(v.sku),
        color: String(v.color || ""),
        size: String(v.size || ""),
        price: String(v.price),
        compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : "",
        stock_quantity: String(v.stock_quantity || 0),
      }))
    );
    if (pv.length === 0) setVariants([{ ...emptyVariant }]);

    const list = await apiJson<{ id: string; url: string }[]>(
      `/api/admin/products/${encodeURIComponent(String(product.id))}/images`
    ).catch(() => [] as { id: string; url: string }[]);

    if (!list.length) {
      setProductImages([]);
    } else {
      setProductImages(list.map((x) => ({ id: x.id, url: x.url })));
    }

    setIsDialogOpen(true);
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const productsList = lines.slice(1).map((line) => {
      const values = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() ?? "";
      });
      return obj;
    });

    try {
      const data = await apiJson<{ created: number; errors?: string[] }>("/api/admin/bulk", {
        method: "POST",
        body: JSON.stringify({ operation: "csv-import", data: { products: productsList } }),
      });
      toast({
        title: "CSV Import Complete",
        description: `${data.created} products processed. ${data.errors?.length || 0} errors.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }

    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const totalStock = (v: Record<string, unknown>[]) =>
    v?.reduce((sum: number, x: Record<string, unknown>) => sum + Number(x.stock_quantity || 0), 0) || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Products</h1>
        <div className="flex gap-2">
          <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          <Button variant="outline" onClick={() => csvInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> CSV Import
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="outline" onClick={() => setIsBulkTagOpen(true)} className="gap-2">
              <Tags className="h-4 w-4" /> Tags ({selectedIds.size})
            </Button>
          )}
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <Input placeholder="Search products or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="border border-border/30 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(filteredProducts.map((p: Record<string, unknown>) => p.id as string)));
                    else setSelectedIds(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Loading…</TableCell></TableRow>
            ) : filteredProducts.map((product: Record<string, unknown>) => (
              <TableRow key={String(product.id)}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id as string)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(product.id as string);
                      else next.delete(product.id as string);
                      setSelectedIds(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-foreground/50">{product.design_name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{(product.categories as Record<string, unknown>)?.name || "—"}</TableCell>
                <TableCell className="text-sm">{formatPrice(Number(product.base_price))}</TableCell>
                <TableCell className="text-sm">{totalStock((product.product_variants as Record<string, unknown>[]) || [])}</TableCell>
                <TableCell className="text-sm">{(product.product_variants as unknown[])?.length || 0}</TableCell>
                <TableCell>
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Active" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openEditDialog(product)} className="p-2 hover:bg-muted rounded"><Edit2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => deleteMutation.mutate(product.id as string)} className="p-2 hover:bg-muted rounded text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} required />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Design Name</Label>
                <Input value={formData.design_name} onChange={(e) => setFormData({ ...formData, design_name: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Price (₹) *</Label>
                <Input type="number" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: e.target.value })} required />
              </div>
              <div>
                <Label>Compare Price (₹)</Label>
                <Input type="number" value={formData.compare_at_price} onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Fabric</Label>
                <Input value={formData.fabric} onChange={(e) => setFormData({ ...formData, fabric: e.target.value })} placeholder="e.g. Cotton" />
              </div>
              <div>
                <Label>Dimensions</Label>
                <Input value={formData.dimensions} onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })} placeholder="e.g. 16x16 inches" />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="floral, cotton" />
              </div>
            </div>

            <div>
              <Label>Care Instructions</Label>
              <Input value={formData.care_instructions} onChange={(e) => setFormData({ ...formData, care_instructions: e.target.value })} placeholder="Machine wash cold" />
            </div>

            <div>
              <Label>Short Description</Label>
              <Input value={formData.short_description} onChange={(e) => setFormData({ ...formData, short_description: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} /> Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} /> Active
              </label>
            </div>

            <div className="border-t border-border/30 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Product Images</Label>
                <div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      const pid = editingProduct?.id ? String(editingProduct.id) : `temp-${Date.now()}`;
                      const urls = await uploadMultiple(files, pid);
                      setProductImages((prev) => [...prev, ...urls.map((u) => ({ url: u }))]);
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1" />}
                    {imageUploading ? "Uploading..." : "Add Images"}
                  </Button>
                </div>
              </div>
              {productImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, i) => (
                    <div key={img.id || i} className="relative group w-20 h-20">
                      <img src={img.url} alt="" className="w-20 h-20 object-cover rounded border border-border/30" />
                      <button
                        type="button"
                        onClick={() => setProductImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/30 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Variants</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setVariants([...variants, { ...emptyVariant }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Variant
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 mb-2 items-end">
                  <div>
                    <Label className="text-xs">SKU *</Label>
                    <Input value={v.sku} onChange={(e) => { const nv = [...variants]; nv[i] = { ...nv[i], sku: e.target.value }; setVariants(nv); }} className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input value={v.color} onChange={(e) => { const nv = [...variants]; nv[i] = { ...nv[i], color: e.target.value }; setVariants(nv); }} className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Size</Label>
                    <Input value={v.size} onChange={(e) => { const nv = [...variants]; nv[i] = { ...nv[i], size: e.target.value }; setVariants(nv); }} className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Price</Label>
                    <Input type="number" value={v.price} onChange={(e) => { const nv = [...variants]; nv[i] = { ...nv[i], price: e.target.value }; setVariants(nv); }} className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Stock</Label>
                    <Input type="number" value={v.stock_quantity} onChange={(e) => { const nv = [...variants]; nv[i] = { ...nv[i], stock_quantity: e.target.value }; setVariants(nv); }} className="h-9 text-xs" />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="h-9">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BulkTagUpdate
        open={isBulkTagOpen}
        onOpenChange={setIsBulkTagOpen}
        selectedProductIds={Array.from(selectedIds)}
      />
    </div>
  );
};

export default AdminProducts;
