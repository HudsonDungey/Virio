import { getAllSlugs, getDoc } from "@/lib/docs/content";

export const dynamic = "force-static";

export function generateStaticParams(): { slug: string }[] {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function GET(_req: Request, { params }: { params: { slug: string } }) {
  const doc = getDoc(params.slug);
  if (!doc) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(doc.raw, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
