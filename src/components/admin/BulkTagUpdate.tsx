import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tags } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProductIds: string[];
}

const BulkTagUpdate = ({ open, onOpenChange, selectedProductIds }: Props) => {
  const [tags, setTags] = useState("");
  const [action, setAction] = useState<"add" | "remove" | "replace">("add");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length === 0) throw new Error("Enter at least one tag");

      if (action === "replace") {
        await apiJson("/api/admin/bulk", {
          method: "POST",
          body: JSON.stringify({
            operation: "bulk-tag-replace",
            data: { productIds: selectedProductIds, tags: tagList },
          }),
        });
        return;
      }

      await apiJson("/api/admin/bulk", {
        method: "POST",
        body: JSON.stringify({
          operation: "bulk-tag-update",
          data: {
            productIds: selectedProductIds,
            tagsToAdd: action === "add" ? tagList : [],
            tagsToRemove: action === "remove" ? tagList : [],
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: `Tags updated on ${selectedProductIds.length} products` });
      onOpenChange(false);
      setTags("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Bulk Tag Update</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground/60">{selectedProductIds.length} products selected</p>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div>
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "add" | "remove" | "replace")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add tags</SelectItem>
                <SelectItem value="remove">Remove tags</SelectItem>
                <SelectItem value="replace">Replace all tags</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="floral, cotton, premium" required />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Updating..." : "Apply to Selected"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTagUpdate;
