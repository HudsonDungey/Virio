import { getNavTree } from "@/lib/docs/content";
import { SITE_URL } from "@/lib/docs/site";

export const dynamic = "force-static";

// Implements the llms.txt convention: a concise, link-rich index for LLMs.
export function GET() {
  const groups = getNavTree();
  const lines: string[] = [
    "# Virio",
    "",
    "> Wallet-native recurring stablecoin payments and programmable billing infrastructure. ",
    "> 100% onchain, public, and permissionless — integrate with your own RPC and the @virio/sdk ",
    "> framework. No API keys, no accounts, no hosted services.",
    "",
    `Full documentation as a single file: ${SITE_URL}/llms-full.txt`,
    "Each page is available as raw Markdown at /raw/<slug>.",
    "",
    "## Docs",
    "",
  ];

  for (const group of groups) {
    lines.push(`### ${group.section}`, "");
    for (const doc of group.items) {
      lines.push(`- [${doc.title}](${SITE_URL}/docs/${doc.slug}): ${doc.description}`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
