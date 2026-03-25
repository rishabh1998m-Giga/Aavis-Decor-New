import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface Props {
  rulesJson: string;
}

const CollectionRulePreview = ({ rulesJson }: Props) => {
  const tagsEncoded = (() => {
    try {
      const rules = JSON.parse(rulesJson);
      const tags = rules.tags || [];
      return Array.isArray(tags) && tags.length > 0
        ? encodeURIComponent(tags.slice(0, 10).map((t: string) => String(t)).join(","))
        : "";
    } catch {
      return "";
    }
  })();

  const { data: matchingProducts = [], isLoading } = useQuery({
    queryKey: ["collection-rule-preview", rulesJson],
    queryFn: async () => {
      if (!tagsEncoded) return [];
      return apiJson<Array<{ id: string; name: string }>>(
        `/api/admin/tag-preview?tags=${tagsEncoded}`
      );
    },
    enabled: !!tagsEncoded,
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
          {matchingProducts.map((p: { id: string; name: string }) => (
            <Badge key={String(p.id)} variant="outline" className="text-xs">{String(p.name)}</Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionRulePreview;
