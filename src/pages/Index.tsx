import StoreLayout from "@/components/layout/StoreLayout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import TrustBadges from "@/components/home/TrustBadges";

const Index = () => {
  return (
    <StoreLayout>
      <HeroBanner />
      <TrustBadges />
      <CategoryShowcase />
      <FeaturedProducts />
    </StoreLayout>
  );
};

export default Index;
