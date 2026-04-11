import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import PageMeta from "@/components/seo/PageMeta";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Settings, ChevronLeft, Layers, Percent, Menu, X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentLink = adminLinks.find((link) => location.pathname === link.href);
  const currentTitle = currentLink ? `${currentLink.label} Admin` : "Admin Panel";

  return (
    <AuthGuard requireAdmin>
      <PageMeta
        title={currentTitle}
        description="Internal Aavis Decor admin panel."
        canonical={location.pathname}
        noIndex
      />
      <div className="flex min-h-screen bg-background">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 border-r border-border/30 bg-background flex flex-col transition-transform duration-300",
            "md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-6 border-b border-border/30">
            <div className="flex items-center justify-between mb-4">
              <Link to="/" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground">
                <ChevronLeft className="h-4 w-4" /> Back to Store
              </Link>
              <button
                className="md:hidden p-1 hover:opacity-70"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h1 className="font-display text-xl">Admin Panel</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-colors",
                  location.pathname === link.href
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-muted/50"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-auto">
          {/* Mobile top bar */}
          <div className="flex items-center gap-3 p-4 border-b border-border/30 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-muted rounded-md"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium">{currentTitle}</span>
          </div>
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default AdminLayout;
