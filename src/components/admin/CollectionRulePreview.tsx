import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface Props {
  rulesJson: string;
}

const CollectionRulePreview = ({ rulesJson }: Props) => {
  const { data: matchingProducts = [], isLoading } = useQuery({
    queryKey: ["collection-rule-preview", rulesJson],
    queryFn: async () => {
      const rules = JSON.parse(rulesJson);
      const tags = rules.tags || [];
      if (tags.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, slug")
        .eq("is_active", true)
        .overlaps("tags", tags)
        .limit(10);
      return data || [];
    },
    enabled: (() => {
      try { const r = JSON.parse(rulesJson); return Array.isArray(r.tags) && r.tags.length > 0; }
      catch { return false; }
    })(),
  });

  if (!rulesJson) return null;

  let valid = true;
  try { JSON.parse(rulesJson); } catch { valid = false; }
  if (!valid) return <p className="text-xs text-destructive">Invalid JSON</p>;

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded text-xs">
      <div className="flex items-center gap-2 mb-2 text-foreground/60">
        <Package className="h-3 w-3" />
        {isLoading ? "Loading preview..." : `${matchingProducts.length}${matchingProducts.length === 10 ? "+" : ""} matching products`}
      </div>
      {matchingProducts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matchingProducts.map((p: any) => (
            <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionRulePreview;
