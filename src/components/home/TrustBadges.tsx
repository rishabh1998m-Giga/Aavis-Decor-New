import { Truck, ShieldCheck, RotateCcw, CreditCard } from "lucide-react";

const badges = [
  { icon: Truck, label: "Free Shipping", sub: "Orders above ₹999" },
  { icon: ShieldCheck, label: "Quality Assured", sub: "100% genuine products" },
  { icon: RotateCcw, label: "Easy Returns", sub: "7-day return policy" },
  { icon: CreditCard, label: "Secure Payments", sub: "UPI, Cards, COD" },
];

const TrustBadges = () => {
  return (
    <section className="py-10 border-y border-border">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {badges.map((badge) => (
            <div key={badge.label} className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <badge.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{badge.label}</p>
                <p className="text-xs text-muted-foreground">{badge.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
