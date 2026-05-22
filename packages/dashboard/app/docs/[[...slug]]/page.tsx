import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowRight, ArrowLeft, FileText } from "lucide-react";
import { getAllSlugs, getDoc, getAdjacent, getNavTree } from "@/lib/docs/content";
import { MarkdownContent } from "@/lib/docs/markdown";
import { DocsToc } from "@/components/docs/docs-toc";
import { SITE_NAME, SITE_URL } from "@/lib/docs/site";

interface PageProps {
  params: { slug?: string[] };
}

export function generateStaticParams(): { slug: string[] }[] {
  return [{ slug: [] }, ...getAllSlugs().map((slug) => ({ slug: [slug] }))];
}

export function generateMetadata({ params }: PageProps): Metadata {
  const slug = params.slug?.[0];
  if (!slug) {
    const title = "Documentation";
    const description =
      "Virio developer documentation — wallet-native recurring stablecoin payments and programmable billing infrastructure.";
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/docs` },
      openGraph: { title: `${title} — ${SITE_NAME}`, description, url: `${SITE_URL}/docs` },
    };
  }
  const doc = getDoc(slug);
  if (!doc) return { title: "Not found" };
  return {
    title: `${doc.title} — ${SITE_NAME} Docs`,
    description: doc.description,
    alternates: { canonical: `${SITE_URL}/docs/${slug}` },
    openGraph: {
      title: `${doc.title} — ${SITE_NAME}`,
      description: doc.description,
      url: `${SITE_URL}/docs/${slug}`,
      type: "article",
    },
  };
}

export default function DocsPage({ params }: PageProps) {
  const slug = params.slug?.[0];
  if (!slug) return <DocsIndex />;

  const doc = getDoc(slug);
  if (!doc) notFound();

  const { prev, next } = getAdjacent(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    description: doc.description,
    url: `${SITE_URL}/docs/${slug}`,
    isPartOf: { "@type": "WebSite", name: `${SITE_NAME} Documentation`, url: `${SITE_URL}/docs` },
  };

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 animate-fade-in">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>{doc.section}</span>
        </div>

        <header className="mt-4">
          <h1 className="font-display text-[32px] font-bold leading-tight tracking-tight text-foreground">
            {doc.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{doc.description}</p>
          <a
            href={`/raw/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="h-3.5 w-3.5" />
            View as Markdown
          </a>
        </header>

        <div className="mt-2">
          <MarkdownContent source={doc.body} />
        </div>

        <nav className="mt-16 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300"
            >
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ArrowLeft className="h-3 w-3" /> Previous
              </span>
              <div className="mt-0.5 font-display text-[14px] font-bold text-foreground">
                {prev.title}
              </div>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/docs/${next.slug}`}
              className="group rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-brand-300"
            >
              <span className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Next <ArrowRight className="h-3 w-3" />
              </span>
              <div className="mt-0.5 font-display text-[14px] font-bold text-foreground">
                {next.title}
              </div>
            </Link>
          )}
        </nav>
      </article>

      <aside className="sticky top-24 hidden h-min w-[190px] flex-shrink-0 xl:block">
        <DocsToc headings={doc.headings} />
      </aside>
    </div>
  );
}

/* ───────────────────────── /docs index ───────────────────────── */

function DocsIndex() {
  const groups = getNavTree();
  return (
    <div className="animate-fade-in">
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-300">
        Documentation
      </p>
      <h1 className="mt-2 font-display text-[34px] font-bold leading-tight tracking-tight text-foreground">
        Build recurring stablecoin payments
      </h1>
      <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Virio is wallet-native recurring payments and programmable billing infrastructure for
        stablecoins. Everything is onchain, public, and permissionless — integrate with your own RPC
        and the <code className="font-mono text-brand-600 dark:text-brand-300">@virio/sdk</code>{" "}
        framework. No API keys, no accounts, no hosted services.
      </p>

      <div className="mt-10 space-y-10">
        {groups.map((group) => (
          <section key={group.section}>
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {group.section}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[15px] font-bold text-foreground">
                      {doc.title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {doc.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
