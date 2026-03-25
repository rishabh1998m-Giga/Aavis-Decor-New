import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Check, X, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface PincodeCheckerProps {
  onPincodeVerified?: (data: {
    pincode: string;
    city: string;
    state: string;
    estimatedDays: number;
    isCodAvailable: boolean;
  }) => void;
}

type PincodeRow = {
  id: string;
  pincode: string;
  is_serviceable?: boolean | null;
  is_cod_available?: boolean | null;
  city?: string | null;
  state?: string | null;
  estimated_days?: number | null;
};

const PincodeChecker = ({ onPincodeVerified }: PincodeCheckerProps) => {
  const [pincode, setPincode] = useState("");
  const [checkPincode, setCheckPincode] = useState<string | null>(null);
  const [data, setData] = useState<PincodeRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = () => {
    if (pincode.length === 6) {
      setCheckPincode(pincode);
      setIsLoading(true);
      // Static catalog mode: we don't call the API. Assume serviceable and show consistent UI.
      // If you later want real pincode support, re-enable the API call.
      setTimeout(() => {
        setData({
          id: `static-${pincode}`,
          pincode,
          is_serviceable: true,
          is_cod_available: true,
          city: null,
          state: null,
          estimated_days: 5,
        });
        setIsLoading(false);
      }, 250);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheck();
    }
  };

  useEffect(() => {
    if (!data || !onPincodeVerified) return;
    onPincodeVerified({
      pincode: data.pincode,
      city: data.city || "",
      state: data.state || "",
      estimatedDays: data.estimated_days || 5,
      isCodAvailable: data.is_cod_available ?? true,
    });
  }, [data, onPincodeVerified]);

  const isChecked = checkPincode && checkPincode.length === 6;
  const isServiceable = !isLoading && Boolean(data);
  const isNotServiceable = !isLoading && Boolean(isChecked && !data);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            type="text"
            placeholder="Enter Pincode"
            value={pincode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPincode(value);
              if (value.length < 6) {
                setCheckPincode(null);
              }
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 h-11"
            maxLength={6}
          />
        </div>
        <Button
          onClick={handleCheck}
          disabled={pincode.length !== 6 || isLoading}
          variant="outline"
          className="h-11 px-6"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Check"
          )}
        </Button>
      </div>

      {isChecked && !isLoading && (
        <div
          className={cn(
            "p-3 rounded-md text-sm",
            isServiceable
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          )}
        >
          {isServiceable && data ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="font-medium">Delivery available</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/70">
                <Truck className="h-4 w-4" />
                <span>
                  Estimated delivery: {data.estimated_days || 5}-{(data.estimated_days || 5) + 2} days
                </span>
              </div>
              {data.city && data.state && (
                <p className="text-foreground/50 text-xs">
                  {data.city}, {data.state}
                </p>
              )}
              {data.is_cod_available && (
                <p className="text-xs text-foreground/60">
                  ✓ Cash on Delivery available
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <X className="h-4 w-4" />
              <span>Sorry, we don't deliver to this pincode yet</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PincodeChecker;
