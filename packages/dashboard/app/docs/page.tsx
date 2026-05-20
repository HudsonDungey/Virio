import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Footer } from "@/components/marketing/footer";
import { DocsView } from "@/components/docs/docs-view";

export const metadata: Metadata = {
  title: "Docs — Virio",
  description:
    "Virio documentation — onchain subscriptions, payroll, webhooks, the fee model, and smart contract architecture.",
};

export default function DocsPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingNav />
      <main>
        <DocsView />
      </main>
      <Footer />
    </div>
  );
}
