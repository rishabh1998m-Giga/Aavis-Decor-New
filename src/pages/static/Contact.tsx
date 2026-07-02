import { useState } from "react";
import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
      setIsSubmitting(false);
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <StoreLayout>
      <PageMeta
        title="Contact Us"
        description="Get in touch with Aavis Decor. We'd love to hear from you about our home textiles, orders, or custom requirements."
        canonical="/contact"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Aavis Decor",
          "url": "https://aavisdecor.com",
          "logo": "https://aavisdecor.com/favicon.png",
          "email": "aavishdecor18@gmail.com",
          "telephone": "+917318447576",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Plot No.09 Anand Industrial Society, Near 64 Joganiyo Mata Mandir, Udhna Magdalla Road",
            "addressLocality": "Surat",
            "postalCode": "35007",
            "addressCountry": "IN"
          }
        }}
      />
      <div className="pb-20 min-h-screen">
        <div className="container max-w-4xl">
          <h1 className="font-display text-4xl mb-4 text-center">Get In Touch</h1>
          <p className="text-center text-foreground/60 mb-12 max-w-lg mx-auto">
            We'd love to hear from you. Whether it's about an order, a product inquiry, or just to say hello.
          </p>

          <div className="grid md:grid-cols-2 gap-16">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="flex gap-4">
                <Mail className="h-5 w-5 text-foreground/60 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Email</p>
                  <a href="mailto:aavishdecor18@gmail.com" className="text-foreground/60 text-sm hover:text-foreground transition-colors">
                    aavishdecor18@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="h-5 w-5 text-foreground/60 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Phone</p>
                  <a href="tel:+917318447576" className="text-foreground/60 text-sm hover:text-foreground transition-colors">
                    +91 73184 47576
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <MapPin className="h-5 w-5 text-foreground/60 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Address</p>
                  <p className="text-foreground/60 text-sm">
                    Plot No.09 Anand Industrial Society,<br />
                    Near 64 Joganiyo Mata Mandir,<br />
                    Udhna Magdalla Road, Surat-35007
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs tracking-widest text-foreground/70">NAME</Label>
                <Input className="h-11 mt-1" required />
              </div>
              <div>
                <Label className="text-xs tracking-widest text-foreground/70">EMAIL</Label>
                <Input type="email" className="h-11 mt-1" required />
              </div>
              <div>
                <Label className="text-xs tracking-widest text-foreground/70">MESSAGE</Label>
                <Textarea className="mt-1" rows={5} required />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest">
                {isSubmitting ? "SENDING..." : "SEND MESSAGE"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default Contact;
