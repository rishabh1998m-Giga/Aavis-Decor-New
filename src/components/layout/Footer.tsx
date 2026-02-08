import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-display text-xl font-bold mb-4">
              LifeN<span className="text-primary">Colors</span>
            </h3>
            <p className="text-sm opacity-70 leading-relaxed">
              Premium home textiles — pillow covers, table cloths & curtains. Handpicked designs to transform your space.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 opacity-80">Shop</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><Link to="/category/pillow-covers" className="hover:opacity-100 transition-opacity">Pillow Covers</Link></li>
              <li><Link to="/category/table-cloths" className="hover:opacity-100 transition-opacity">Table Cloths</Link></li>
              <li><Link to="/category/curtains" className="hover:opacity-100 transition-opacity">Curtains</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 opacity-80">Support</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><Link to="/contact" className="hover:opacity-100 transition-opacity">Contact Us</Link></li>
              <li><Link to="/shipping" className="hover:opacity-100 transition-opacity">Shipping Policy</Link></li>
              <li><Link to="/returns" className="hover:opacity-100 transition-opacity">Returns & Refunds</Link></li>
              <li><Link to="/faq" className="hover:opacity-100 transition-opacity">FAQ</Link></li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 opacity-80">Why Us</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li>✓ 100% Quality Assured</li>
              <li>✓ Free Shipping Above ₹999</li>
              <li>✓ COD Available</li>
              <li>✓ Easy 7-Day Returns</li>
              <li>✓ GST Invoice Provided</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/10 text-center text-xs opacity-50">
          © {new Date().getFullYear()} LifeNColors. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
