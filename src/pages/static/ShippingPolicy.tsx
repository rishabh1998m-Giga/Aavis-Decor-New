import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";

const ShippingPolicy = () => (
  <StoreLayout>
    <PageMeta
      title="Shipping Policy"
      description="Shipping timelines, charges, COD availability, and delivery coverage for Aavis Decor orders in India."
      canonical="/shipping-policy"
    />
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container max-w-3xl">
        <h1 className="font-display text-4xl mb-8">Shipping Policy</h1>
        <div className="prose text-foreground/80 space-y-6">
          <h2 className="font-display text-xl text-foreground">Delivery Times</h2>
          <p>Standard delivery takes 5-7 business days across India. Metro cities may receive orders in 3-5 business days.</p>
          
          <h2 className="font-display text-xl text-foreground">Shipping Charges</h2>
          <ul>
            <li>Free shipping on orders above ₹999</li>
            <li>Flat ₹99 shipping for orders below ₹999</li>
            <li>Cash on Delivery available at select pincodes (+₹49 COD fee)</li>
          </ul>

          <h2 className="font-display text-xl text-foreground">Tracking</h2>
          <p>Once shipped, you'll receive a tracking ID via email and SMS. Track your order from the My Orders section.</p>

          <h2 className="font-display text-xl text-foreground">Serviceability</h2>
          <p>We deliver across major cities in India. Check pincode availability on the product page or cart.</p>
        </div>
      </div>
    </div>
  </StoreLayout>
);

export default ShippingPolicy;
