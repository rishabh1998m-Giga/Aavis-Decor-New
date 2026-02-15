import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import CartDrawer from "@/components/cart/CartDrawer";
import AuthGuard from "@/components/auth/AuthGuard";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Category from "./pages/Category";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import OrderTracking from "./pages/OrderTracking";
import Account from "./pages/Account";
import AccountOrders from "./pages/account/Orders";
import AccountAddresses from "./pages/account/Addresses";
import Collections from "./pages/Collections";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminCollections from "./pages/admin/Collections";
import AdminDiscounts from "./pages/admin/Discounts";
import AdminCustomers from "./pages/admin/Customers";
import AdminSettings from "./pages/admin/Settings";

// Static
import About from "./pages/static/About";
import Contact from "./pages/static/Contact";
import ShippingPolicy from "./pages/static/ShippingPolicy";
import ReturnsPolicy from "./pages/static/ReturnsPolicy";
import Privacy from "./pages/static/Privacy";
import Terms from "./pages/static/Terms";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/category/:slug" element={<Category />} />
              <Route path="/collections/:slug" element={<Collections />} />
              <Route path="/product/:slug" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation />} />
              <Route path="/order-tracking/:orderNumber" element={<OrderTracking />} />
              <Route path="/order-tracking" element={<OrderTracking />} />

              {/* Account - requires authentication */}
              <Route path="/account" element={<AuthGuard><Account /></AuthGuard>}>
                <Route path="orders" element={<AccountOrders />} />
                <Route path="addresses" element={<AccountAddresses />} />
              </Route>

              {/* Admin - requires admin role */}
              <Route path="/admin" element={<AuthGuard requireAdmin><AdminLayout /></AuthGuard>}>
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="collections" element={<AdminCollections />} />
                <Route path="discounts" element={<AdminDiscounts />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Static */}
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/returns" element={<ReturnsPolicy />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            <CartDrawer />
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
