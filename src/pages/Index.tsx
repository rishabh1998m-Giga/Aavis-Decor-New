import StoreLayout from "@/components/layout/StoreLayout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import TrustBadges from "@/components/home/TrustBadges";
import PageMeta from "@/components/seo/PageMeta";

const Index = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HomeGoodsStore",
    name: "Cushy Crafts",
    description: "Premium handcrafted home textiles — pillow covers, curtains, table cloths & more.",
    url: window.location.origin,
  };

  return (
    <StoreLayout>
      <PageMeta
        title="Cushy Crafts"
        description="Shop premium handcrafted pillow covers, curtains, table cloths and home textiles. Quality fabrics, elegant designs, free shipping across India."
        jsonLd={jsonLd}
      />
      <HeroBanner />
      <TrustBadges />
      <CategoryShowcase />
      <FeaturedProducts />
    </StoreLayout>
  );
};

export default Index;
