import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";

const About = () => (
  <StoreLayout>
    <PageMeta
      title="About Us"
      description="Learn about Aavis Decor — our story, mission, and commitment to quality handcrafted home textiles."
      canonical="/about"
    />
    <div className="pt-32 pb-20 min-h-screen">
      <div className="container max-w-3xl">
        <h1 className="font-display text-4xl mb-8">Our Story</h1>
        <div className="prose prose-lg text-foreground/70 space-y-6">
          <p>
            At <strong className="text-foreground">Aavis Decor</strong>, we believe that every home tells a story. 
            Our mission is to help you write yours with fabrics that inspire, comfort, and transform 
            your living spaces into sanctuaries of beauty.
          </p>
          <p>
            Founded with a passion for Indian textile heritage, we bring together traditional 
            craftsmanship and contemporary design. Each piece in our collection is thoughtfully 
            curated — from hand-block printed cushion covers to luxurious velvet curtains — 
            ensuring that every product carries the warmth of artisanal touch.
          </p>
          <p>
            We work directly with skilled artisans across India, supporting local communities 
            while bringing you authentic, high-quality home textiles at honest prices.
          </p>
          <h2 className="font-display text-2xl text-foreground mt-12">Our Promise</h2>
          <ul className="space-y-3">
            <li>Premium quality fabrics that last</li>
            <li>Ethically sourced and responsibly made</li>
            <li>Supporting Indian artisan communities</li>
            <li>Thoughtful designs for modern living</li>
          </ul>
        </div>
      </div>
    </div>
  </StoreLayout>
);

export default About;
