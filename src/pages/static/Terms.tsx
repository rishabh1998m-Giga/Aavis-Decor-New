import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";

const Terms = () => (
  <StoreLayout>
    <PageMeta
      title="Terms of Service"
      description="Terms governing purchases, pricing, account responsibilities, and legal use of aavisdecor.com."
      canonical="/terms"
    />
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container max-w-3xl">
        <h1 className="font-display text-4xl mb-8">Terms of Service</h1>
        <div className="prose text-foreground/80 space-y-6">
          <p>Last updated: February 2026</p>
          <p>By using aavisdecor.com, you agree to the following terms and conditions.</p>

          <h2 className="font-display text-xl text-foreground">Orders & Pricing</h2>
          <p>All prices are listed in Indian Rupees (₹) and include GST. We reserve the right to modify prices without notice. Orders are confirmed only upon payment verification.</p>

          <h2 className="font-display text-xl text-foreground">Product Descriptions</h2>
          <p>We strive to accurately display product colors and details. Minor variations may occur due to screen settings and the handcrafted nature of our products.</p>

          <h2 className="font-display text-xl text-foreground">Account Responsibility</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and all activities under your account.</p>

          <h2 className="font-display text-xl text-foreground">Intellectual Property</h2>
          <p>All content, designs, and images on this website are the property of Aavis Decor and may not be reproduced without permission.</p>

          <h2 className="font-display text-xl text-foreground">Governing Law</h2>
          <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in New Delhi.</p>
        </div>
      </div>
    </div>
  </StoreLayout>
);

export default Terms;
