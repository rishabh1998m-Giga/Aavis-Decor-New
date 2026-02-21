import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background/80">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-2xl text-background mb-4 tracking-wide">
              Aavis Decor
            </h3>
            <p className="text-sm leading-relaxed opacity-70 max-w-xs">
              Weaving beautiful life stories through art, created for the spaces you call home.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-widest mb-5 opacity-50">Shop</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/category/pillow-covers" className="opacity-70 hover:opacity-100 transition-opacity">Pillow Covers</Link></li>
              <li><Link to="/category/table-cloths" className="opacity-70 hover:opacity-100 transition-opacity">Table Cloths</Link></li>
              <li><Link to="/category/curtains" className="opacity-70 hover:opacity-100 transition-opacity">Curtains</Link></li>
              <li><Link to="/collections" className="opacity-70 hover:opacity-100 transition-opacity">All Collections</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-widest mb-5 opacity-50">Support</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/contact" className="opacity-70 hover:opacity-100 transition-opacity">Contact Us</Link></li>
              <li><Link to="/shipping-policy" className="opacity-70 hover:opacity-100 transition-opacity">Shipping Policy</Link></li>
              <li><Link to="/returns" className="opacity-70 hover:opacity-100 transition-opacity">Returns & Refunds</Link></li>
              <li><Link to="/about" className="opacity-70 hover:opacity-100 transition-opacity">About Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-widest mb-5 opacity-50">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/privacy" className="opacity-70 hover:opacity-100 transition-opacity">Privacy Policy</Link></li>
              <li><Link to="/terms" className="opacity-70 hover:opacity-100 transition-opacity">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-widest mb-5 opacity-50">Why Us</h4>
            <ul className="space-y-3 text-sm opacity-70">
              <li>100% Quality Assured</li>
              <li>Free Shipping Above ₹999</li>
              <li>COD Available</li>
              <li>Easy 7-Day Returns</li>
              <li>GST Invoice Provided</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-background/10 text-center text-xs opacity-40 tracking-wide">
          © {new Date().getFullYear()} Aavis Decor. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
