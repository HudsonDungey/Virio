import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, extractHeadings, type Heading } from "./markdown";

// Server-only: reads Markdown docs from the filesystem at build time.
const DOCS_DIR = join(process.cwd(), "content", "docs");

export const SECTION_ORDER = ["Getting started", "Build", "Protocol"] as const;

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
}

export interface DocFull extends DocEntry {
  body: string;
  raw: string;
  headings: Heading[];
}

function readAll(): DocFull[] {
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const raw = readFileSync(join(DOCS_DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    return {
      slug: file.replace(/\.md$/, ""),
      title: data.title,
      description: data.description,
      section: data.section,
      order: data.order,
      body,
      raw,
      headings: extractHeadings(body),
    };
  });
}

function sectionRank(section: string): number {
  const idx = (SECTION_ORDER as readonly string[]).indexOf(section);
  return idx === -1 ? SECTION_ORDER.length : idx;
}

/** All docs in canonical reading order (section order, then per-section `order`). */
export function getAllDocs(): DocEntry[] {
  return readAll()
    .map(({ slug, title, description, section, order }) => ({
      slug,
      title,
      description,
      section,
      order,
    }))
    .sort((a, b) => sectionRank(a.section) - sectionRank(b.section) || a.order - b.order);
}

export function getAllSlugs(): string[] {
  return getAllDocs().map((d) => d.slug);
}

export function getDoc(slug: string): DocFull | undefined {
  return readAll().find((d) => d.slug === slug);
}

export interface NavGroup {
  section: string;
  items: DocEntry[];
}

/** Docs grouped by section in canonical order — drives the sidebar. */
export function getNavTree(): NavGroup[] {
  const docs = getAllDocs();
  const groups: NavGroup[] = [];
  for (const section of SECTION_ORDER) {
    const items = docs.filter((d) => d.section === section);
    if (items.length > 0) groups.push({ section, items });
  }
  // Any sections not in SECTION_ORDER, appended at the end.
  for (const doc of docs) {
    if (!(SECTION_ORDER as readonly string[]).includes(doc.section)) {
      let group = groups.find((g) => g.section === doc.section);
      if (!group) {
        group = { section: doc.section, items: [] };
        groups.push(group);
      }
      if (!group.items.includes(doc)) group.items.push(doc);
    }
  }
  return groups;
}

/** Previous / next docs around a slug, for footer pagination. */
export function getAdjacent(slug: string): { prev?: DocEntry; next?: DocEntry } {
  const docs = getAllDocs();
  const idx = docs.findIndex((d) => d.slug === slug);
  if (idx === -1) return {};
  return { prev: docs[idx - 1], next: docs[idx + 1] };
}
