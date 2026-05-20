import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Footer } from "@/components/marketing/footer";
import { DevView } from "@/components/dev/dev-view";

export const metadata: Metadata = {
  title: "Developers — Virio",
  description:
    "The Virio developer portal — SDKs, API keys, interactive API references, event schemas, and integration examples.",
};

export default function DevPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingNav />
      <main>
        <DevView />
      </main>
      <Footer />
    </div>
  );
}
