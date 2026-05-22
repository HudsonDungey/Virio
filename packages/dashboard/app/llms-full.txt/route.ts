import { getAllDocs, getDoc } from "@/lib/docs/content";
import { SITE_URL } from "@/lib/docs/site";

export const dynamic = "force-static";

// The entire documentation concatenated as Markdown — the format AI coding
// tools and retrieval systems consume best.
export function GET() {
  const parts: string[] = [
    "# Virio Documentation",
    "",
    "Wallet-native recurring stablecoin payments and programmable billing infrastructure.",
    "100% onchain, public, permissionless. No API keys, no accounts, no hosted services.",
    "",
    "---",
    "",
  ];

  for (const entry of getAllDocs()) {
    const doc = getDoc(entry.slug);
    if (!doc) continue;
    parts.push(`# ${doc.title}`, "");
    parts.push(`Source: ${SITE_URL}/docs/${doc.slug}`, "");
    parts.push(doc.body.trim(), "", "---", "");
  }

  return new Response(parts.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
