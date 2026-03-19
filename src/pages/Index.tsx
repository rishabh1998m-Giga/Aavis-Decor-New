import StoreLayout from "@/components/layout/StoreLayout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import TrustBadges from "@/components/home/TrustBadges";
import StorySection from "@/components/home/StorySection";
import NewsletterSection from "@/components/home/NewsletterSection";
import PageMeta from "@/components/seo/PageMeta";

const Index = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HomeGoodsStore",
    name: "Aavis Decor",
    description: "Premium handcrafted home textiles — pillow covers, curtains, table cloths & more.",
    url: window.location.origin,
  };

  return (
    <StoreLayout>
      <PageMeta
        title="Aavis Decor"
        description="Shop premium handcrafted pillow covers, curtains, table cloths and home textiles. Quality fabrics, elegant designs, free shipping across India."
        canonical="/"
        jsonLd={jsonLd}
      />
      <HeroBanner />
      <TrustBadges />
      <CategoryShowcase />
      <StorySection />
      <FeaturedProducts />
      <NewsletterSection />
    </StoreLayout>
  );
};

export default Index;
