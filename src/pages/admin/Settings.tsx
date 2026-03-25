import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const AdminSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gstSettings } = useQuery({
    queryKey: ["gst-settings"],
    queryFn: async () => apiJson<Record<string, unknown> | null>("/api/admin/settings/gst"),
  });

  const { data: shippingRules = [] } = useQuery({
    queryKey: ["shipping-rules"],
    queryFn: async () => apiJson<Record<string, unknown>[]>("/api/admin/shipping-rules"),
  });

  const [gstForm, setGstForm] = useState({
    business_name: "",
    gstin: "",
    default_gst_rate: "18",
    business_state: "",
    business_address: "",
    invoice_prefix: "INV",
    is_gst_inclusive: false,
  });

  useEffect(() => {
    if (gstSettings) {
      setGstForm({
        business_name: (gstSettings.business_name as string) || "",
        gstin: (gstSettings.gstin as string) || "",
        default_gst_rate: String(gstSettings.default_gst_rate || 18),
        business_state: (gstSettings.business_state as string) || "",
        business_address: (gstSettings.business_address as string) || "",
        invoice_prefix: (gstSettings.invoice_prefix as string) || "INV",
        is_gst_inclusive: Boolean(gstSettings.is_gst_inclusive),
      });
    }
  }, [gstSettings]);

  const updateGstMutation = useMutation({
    mutationFn: async () => {
      await apiJson("/api/admin/settings/gst", {
        method: "PUT",
        body: JSON.stringify({
          business_name: gstForm.business_name,
          gstin: gstForm.gstin,
          default_gst_rate: Number(gstForm.default_gst_rate),
          business_state: gstForm.business_state,
          business_address: gstForm.business_address,
          invoice_prefix: gstForm.invoice_prefix,
          is_gst_inclusive: gstForm.is_gst_inclusive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gst-settings"] });
      toast({ title: "GST settings updated" });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">GST Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Business Name</Label>
                <Input value={gstForm.business_name} onChange={(e) => setGstForm({ ...gstForm, business_name: e.target.value })} />
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input value={gstForm.gstin} onChange={(e) => setGstForm({ ...gstForm, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default GST Rate (%)</Label>
                <Input type="number" value={gstForm.default_gst_rate} onChange={(e) => setGstForm({ ...gstForm, default_gst_rate: e.target.value })} />
              </div>
              <div>
                <Label>Invoice Prefix</Label>
                <Input value={gstForm.invoice_prefix} onChange={(e) => setGstForm({ ...gstForm, invoice_prefix: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Business State</Label>
              <Input value={gstForm.business_state} onChange={(e) => setGstForm({ ...gstForm, business_state: e.target.value })} />
            </div>
            <div>
              <Label>Business Address</Label>
              <Input value={gstForm.business_address} onChange={(e) => setGstForm({ ...gstForm, business_address: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={gstForm.is_gst_inclusive} onCheckedChange={(checked) => setGstForm({ ...gstForm, is_gst_inclusive: checked })} />
              <Label>Prices are GST inclusive</Label>
            </div>
            <Button onClick={() => updateGstMutation.mutate()} disabled={updateGstMutation.isPending}>
              {updateGstMutation.isPending ? "Saving..." : "Save GST Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Shipping Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shippingRules.map((rule: Record<string, unknown>) => (
                <div key={String(rule.id)} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-foreground/50">
                      Flat rate: ₹{rule.flat_rate} | Free above: ₹{rule.free_shipping_threshold}
                      {rule.is_cod_available && ` | COD fee: ₹${rule.cod_fee}`}
                    </p>
                  </div>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
