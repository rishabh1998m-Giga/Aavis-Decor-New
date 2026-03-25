import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AccountAddresses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["my-addresses", user?.id ],
    queryFn: async () => apiJson<Record<string, unknown>[]>("/api/me/addresses"),
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/api/me/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
      toast({ title: "Address deleted" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-24" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl">Saved Addresses</h2>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="h-16 w-16 text-foreground/20 mx-auto mb-4" />
          <p className="text-foreground/50">No saved addresses</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((address: Record<string, unknown>) => (
            <div key={String(address.id)} className="border border-border/30 rounded-md p-4 relative">
              {address.is_default && (
                <span className="text-[10px] tracking-widest text-foreground/50 uppercase">Default</span>
              )}
              <p className="font-medium text-sm">{address.full_name}</p>
              <p className="text-sm text-foreground/70">{address.address_line1}</p>
              {address.address_line2 && <p className="text-sm text-foreground/70">{String(address.address_line2)}</p>}
              <p className="text-sm text-foreground/70">
                {address.city}, {address.state} - {address.pincode}
              </p>
              <p className="text-sm text-foreground/70">{address.phone}</p>
              <button
                onClick={() => deleteMutation.mutate(String(address.id))}
                className="absolute top-4 right-4 text-foreground/30 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountAddresses;
