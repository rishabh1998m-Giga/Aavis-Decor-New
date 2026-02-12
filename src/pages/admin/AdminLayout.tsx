import { Link, Outlet, useLocation } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Settings, ChevronLeft, Tag, Layers, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminLinks = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Collections", href: "/admin/collections", icon: Layers },
  { label: "Discounts", href: "/admin/discounts", icon: Percent },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const AdminLayout = () => {
  const location = useLocation();

  return (
    <AuthGuard requireAdmin>
      <div className="flex min-h-screen bg-background">
        <aside className="w-64 border-r border-border/30 bg-muted/30 flex flex-col">
          <div className="p-6 border-b border-border/30">
            <Link to="/" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground mb-4">
              <ChevronLeft className="h-4 w-4" /> Back to Store
            </Link>
            <h1 className="font-display text-xl">Admin Panel</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-colors",
                  location.pathname === link.href
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-background/50"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  );
};

export default AdminLayout;
