import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Footer } from "@/components/marketing/footer";
import { PulseTokenView } from "@/components/pulse/pulse-token-view";

export const metadata: Metadata = {
  title: "$PULSE — The token that powers Pulse",
  description:
    "$PULSE tokenomics in plain English. Supply, vesting, real USDC yield, fee discounts, and what holders can earn — all explained simply.",
};

export default function PulseTokenPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingNav />
      <main>
        <PulseTokenView />
      </main>
      <Footer />
    </div>
  );
}
