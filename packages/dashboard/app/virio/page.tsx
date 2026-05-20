import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Footer } from "@/components/marketing/footer";
import { VirioTokenView } from "@/components/virio/virio-token-view";

export const metadata: Metadata = {
  title: "$VIRIO — The token that powers Virio",
  description:
    "$VIRIO tokenomics in plain English. Supply, vesting, real USDC yield, fee discounts, and what holders can earn — all explained simply.",
};

export default function VirioTokenPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingNav />
      <main>
        <VirioTokenView />
      </main>
      <Footer />
    </div>
  );
}
