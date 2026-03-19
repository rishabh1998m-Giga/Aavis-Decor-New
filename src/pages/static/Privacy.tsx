import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";

const Privacy = () => (
  <StoreLayout>
    <PageMeta
      title="Privacy Policy"
      description="How Aavis Decor collects, uses, and protects customer data across orders, accounts, and communication."
      canonical="/privacy"
    />
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container max-w-3xl">
        <h1 className="font-display text-4xl mb-8">Privacy Policy</h1>
        <div className="prose text-foreground/80 space-y-6">
          <p>Last updated: February 2026</p>
          <p>Aavis Decor ("we", "our") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information.</p>

          <h2 className="font-display text-xl text-foreground">Information We Collect</h2>
          <ul>
            <li>Name, email, phone number when you create an account</li>
            <li>Shipping and billing addresses for order fulfillment</li>
            <li>Payment information (processed securely via Razorpay)</li>
            <li>Browsing data and cookies for improving our services</li>
          </ul>

          <h2 className="font-display text-xl text-foreground">How We Use Your Data</h2>
          <ul>
            <li>Processing and fulfilling orders</li>
            <li>Sending order updates and delivery notifications</li>
            <li>Improving our products and services</li>
            <li>Marketing communications (with your consent)</li>
          </ul>

          <h2 className="font-display text-xl text-foreground">Data Security</h2>
          <p>We use industry-standard encryption and security measures. Payment data is processed by Razorpay and never stored on our servers.</p>

          <h2 className="font-display text-xl text-foreground">Contact</h2>
          <p>For privacy-related queries, email us at privacy@aavisdecor.com</p>
        </div>
      </div>
    </div>
  </StoreLayout>
);

export default Privacy;
