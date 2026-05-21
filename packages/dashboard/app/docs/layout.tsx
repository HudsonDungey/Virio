import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Footer } from "@/components/marketing/footer";
import { DocsSidebar, type SidebarGroup } from "@/components/docs/docs-sidebar";
import { getNavTree } from "@/lib/docs/content";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups: SidebarGroup[] = getNavTree().map((g) => ({
    section: g.section,
    items: g.items.map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      section: d.section,
    })),
  }));

  return (
    <div className="relative min-h-screen bg-background">
      <MarketingNav />
      <div className="mx-auto flex max-w-[1240px] gap-8 px-5 pb-24 pt-28 sm:px-8">
        <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-[230px] flex-shrink-0 overflow-y-auto scrollbar-none lg:block">
          <DocsSidebar groups={groups} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
