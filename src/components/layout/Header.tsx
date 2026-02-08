import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Search, User, Menu, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Pillow Covers", href: "/category/pillow-covers" },
  { label: "Table Cloths", href: "/category/table-cloths" },
  { label: "Curtains", href: "/category/curtains" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      {/* Top bar */}
      <div className="bg-foreground text-background text-xs py-1.5 text-center tracking-wide">
        Free Shipping on Orders Above ₹999 | COD Available
      </div>

      <div className="container flex items-center justify-between h-16">
        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-2 -ml-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-xl md:text-2xl font-bold tracking-tight text-foreground">
            LifeN<span className="text-primary">Colors</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/wishlist">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/auth">
              <User className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link to="/cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                0
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      <div
        className={cn(
          "lg:hidden overflow-hidden transition-all duration-300 border-t border-border",
          mobileOpen ? "max-h-60" : "max-h-0 border-t-0"
        )}
      >
        <nav className="container py-4 flex flex-col gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground py-1"
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
