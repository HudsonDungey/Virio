import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DeveloperSection } from "@/components/marketing/developer-section";
import { Pricing } from "@/components/marketing/pricing";
import { CtaSection } from "@/components/marketing/cta-section";
import { Footer } from "@/components/marketing/footer";
import { SeedBanner } from "@/components/marketing/seed-banner";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <SeedBanner />
      <MarketingNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <DeveloperSection />
        <Pricing />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
