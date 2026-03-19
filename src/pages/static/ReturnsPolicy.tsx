import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";

const ReturnsPolicy = () => (
  <StoreLayout>
    <PageMeta
      title="Returns & Exchanges"
      description="Read Aavis Decor's return window, exchange policy, and refund process for home textile orders."
      canonical="/returns"
    />
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container max-w-3xl">
        <h1 className="font-display text-4xl mb-8">Returns & Exchanges</h1>
        <div className="prose text-foreground/80 space-y-6">
          <h2 className="font-display text-xl text-foreground">Return Window</h2>
          <p>We accept returns within 7 days of delivery for unused, unwashed items in their original packaging.</p>

          <h2 className="font-display text-xl text-foreground">How to Return</h2>
          <ol>
            <li>Contact us at hello@aavisdecor.com with your order number</li>
            <li>We'll arrange a pickup from your address</li>
            <li>Refund will be processed within 5-7 business days after inspection</li>
          </ol>

          <h2 className="font-display text-xl text-foreground">Non-Returnable Items</h2>
          <ul>
            <li>Customized or personalized products</li>
            <li>Items marked as "Final Sale"</li>
            <li>Used, washed, or altered items</li>
          </ul>

          <h2 className="font-display text-xl text-foreground">Exchanges</h2>
          <p>We offer free exchanges for size or color within 7 days, subject to availability.</p>
        </div>
      </div>
    </div>
  </StoreLayout>
);

export default ReturnsPolicy;
