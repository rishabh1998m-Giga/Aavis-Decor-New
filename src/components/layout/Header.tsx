import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, User, Menu, X, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useProducts";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount, setIsOpen } = useCart();
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();

  const categoryNavLinks = categories.map((c) => ({
    label: c.name.toUpperCase(),
    href: `/category/${c.slug}`,
  }));
  const navLinks = [
    ...categoryNavLinks,
    { label: "SHOP ALL", href: "/collections" },
  ];

  return (
    <header id="site-header" className="fixed top-0 left-0 right-0 z-50">
      {/* Announcement bar */}
      <div className="bg-foreground/90 text-background text-[11px] py-2 text-center tracking-widest font-light">
        Art, created for the spaces you call home.
      </div>

      <div className="bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex items-center justify-between h-16 lg:h-20">
          {/* Left: Search */}
          <div className="flex items-center gap-4 w-32">
            <button
              className="p-2 hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm"
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-foreground" strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          {/* Center: Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <h1 className="font-display text-2xl lg:text-3xl text-foreground tracking-wide">
              Aavis Decor
            </h1>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 w-32 justify-end">
            <Link
              to={user ? "/account" : "/auth"}
              className="p-2 hover:opacity-70 transition-opacity hidden sm:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm"
              aria-label={user ? "Account" : "Sign in"}
            >
              <User className="h-5 w-5 text-foreground" strokeWidth={1.5} aria-hidden />
            </Link>
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 hover:opacity-70 transition-opacity relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm"
              aria-label={`Shopping bag${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}` : ", empty"}`}
            >
              <ShoppingBag className="h-5 w-5 text-foreground" strokeWidth={1.5} aria-hidden />
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-accent text-accent-foreground text-[9px] font-medium rounded-full h-4 w-4 flex items-center justify-center" aria-hidden>
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </button>
            <button
              className="p-2 lg:hidden hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? (
                <X className="h-5 w-5 text-foreground" strokeWidth={1.5} aria-hidden />
              ) : (
                <Menu className="h-5 w-5 text-foreground" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex justify-center gap-10 pb-4 flex-nowrap whitespace-nowrap overflow-x-auto">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-[11px] font-medium tracking-widest text-foreground/70 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Nav — inside header so it sits flush below header content at any height */}
      <div
        id="mobile-nav"
        className={cn(
          "lg:hidden bg-background/98 backdrop-blur-md border-b border-border transition-all duration-300 overflow-hidden",
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="container py-6 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-xs font-medium tracking-widest text-foreground/70 hover:text-foreground py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
