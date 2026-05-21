import * as React from "react";
import { CodeWindow, type CodeTab } from "@/components/marketing/code-window";
import { Diagram } from "@/components/docs/diagram";
import {
  A,
  Callout,
  Em,
  H1,
  H2,
  H3,
  H4,
  Hr,
  InlineCode,
  Li,
  Ol,
  P,
  Strong,
  Table,
  Ul,
} from "@/components/docs/prose";

/*
 * A small, deterministic Markdown renderer for Virio docs. It supports exactly
 * the constructs the docs use — headings, paragraphs, lists, GFM tables, fenced
 * code (rendered through the CodeWindow primitive), blockquotes, and two custom
 * container directives: `:::code-group` (tabbed code) and `:::diagram <id>`.
 * The same Markdown is served raw at /raw/<slug> and /llms-full.txt for AI tools.
 */

export interface Heading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface DocFrontmatter {
  title: string;
  description: string;
  section: string;
  order: number;
}

const CALLOUT_VARIANTS = new Set(["callout", "note", "info", "warning", "success", "tip"]);

/* ───────────────────────── frontmatter ───────────────────────── */

export function parseFrontmatter(src: string): {
  data: DocFrontmatter;
  body: string;
} {
  const normalized = src.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  const data: Record<string, string> = {};
  let body = normalized;
  if (match) {
    body = normalized.slice(match[0].length);
    for (const line of match[1].split("\n")) {
      const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (kv) data[kv[1]] = stripQuotes(kv[2].trim());
    }
  }
  return {
    body,
    data: {
      title: data.title ?? "Untitled",
      description: data.description ?? "",
      section: data.section ?? "Docs",
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999,
    },
  };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/* ───────────────────────── slugs + headings ───────────────────────── */

export function plainText(md: string): string {
  return md
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function slugify(text: string): string {
  return plainText(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractHeadings(body: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (m) {
      const text = plainText(m[2]);
      headings.push({
        depth: m[1].length as 2 | 3,
        id: slugify(text),
        text,
      });
    }
  }
  return headings;
}

/* ───────────────────────── block model ───────────────────────── */

type Block =
  | { kind: "heading"; depth: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; tabs: CodeTab[] }
  | { kind: "callout"; variant: "info" | "note" | "warning" | "success"; blocks: Block[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "diagram"; id: string }
  | { kind: "hr" };

function isBlockStart(line: string): boolean {
  const t = line.trimStart();
  return (
    t.startsWith("```") ||
    t.startsWith(":::") ||
    t.startsWith("#") ||
    t.startsWith("> ") ||
    t.startsWith("|") ||
    /^[-*]\s+/.test(t) ||
    /^\d+\.\s+/.test(t) ||
    /^---+$/.test(line.trim())
  );
}

function parseInfoString(info: string): { language: string; meta: Record<string, string> } {
  const meta: Record<string, string> = {};
  const metaRe = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(info)) !== null) meta[m[1]] = m[2];
  const language = info.replace(metaRe, "").trim().split(/\s+/)[0] || "text";
  return { language, meta };
}

function parseFences(lines: string[]): CodeTab[] {
  const tabs: CodeTab[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const { language, meta } = parseInfoString(line.trim().slice(3));
      const code: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      tabs.push({
        label: meta.tab ?? meta.title ?? language,
        language,
        filename: meta.title ?? meta.file,
        code: code.join("\n"),
      });
    } else {
      i++;
    }
  }
  return tabs;
}

function parseBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // fenced code (standalone)
    if (trimmed.startsWith("```")) {
      const { language, meta } = parseInfoString(trimmed.slice(3));
      const code: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({
        kind: "code",
        tabs: [
          {
            label: meta.tab ?? language,
            language,
            filename: meta.title ?? meta.file,
            code: code.join("\n"),
          },
        ],
      });
      continue;
    }

    // container directives
    if (trimmed.startsWith(":::")) {
      const header = trimmed.slice(3).trim();
      const name = header.split(/\s+/)[0];
      const arg = header.slice(name.length).trim();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") {
        inner.push(lines[i]);
        i++;
      }
      i++; // closing :::

      if (name === "diagram") {
        blocks.push({ kind: "diagram", id: arg });
      } else if (name === "code-group") {
        blocks.push({ kind: "code", tabs: parseFences(inner) });
      } else if (CALLOUT_VARIANTS.has(name)) {
        const variant =
          name === "warning" ? "warning" : name === "success" ? "success" : name === "note" ? "note" : "info";
        blocks.push({ kind: "callout", variant, blocks: parseBlocks(inner.join("\n")) });
      }
      continue;
    }

    // heading
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", depth: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    // horizontal rule
    if (/^---+$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // blockquote → note callout
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "callout", variant: "note", blocks: parseBlocks(quote.join("\n")) });
      continue;
    }

    // table
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const head = splitRow(tableLines[0]);
        const rows = tableLines.slice(2).map(splitRow);
        blocks.push({ kind: "table", head, rows });
        continue;
      }
    }

    // unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered: false, items });
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered: true, items });
      continue;
    }

    // paragraph (gather until blank / next block start)
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/* ───────────────────────── inline ───────────────────────── */

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\[[^\]]+\]\([^)]+\))|(_[^_]+?_)/g;

export function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      nodes.push(<InlineCode key={key++}>{tok.slice(1, -1)}</InlineCode>);
    } else if (m[2]) {
      nodes.push(<Strong key={key++}>{renderInline(tok.slice(2, -2))}</Strong>);
    } else if (m[3]) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) nodes.push(<A key={key++} href={link[2]}>{renderInline(link[1])}</A>);
    } else if (m[4]) {
      nodes.push(<Em key={key++}>{renderInline(tok.slice(1, -1))}</Em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ───────────────────────── render ───────────────────────── */

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.kind) {
    case "heading": {
      const id = slugify(block.text);
      const inline = renderInline(block.text);
      if (block.depth === 1) return <H1 key={key}>{inline}</H1>;
      if (block.depth === 2) return <H2 key={key} id={id}>{inline}</H2>;
      if (block.depth === 3) return <H3 key={key} id={id}>{inline}</H3>;
      return <H4 key={key} id={id}>{inline}</H4>;
    }
    case "paragraph":
      return <P key={key}>{renderInline(block.text)}</P>;
    case "list":
      return block.ordered ? (
        <Ol key={key}>
          {block.items.map((it, idx) => (
            <Li key={idx} ordered index={idx}>
              {renderInline(it)}
            </Li>
          ))}
        </Ol>
      ) : (
        <Ul key={key}>
          {block.items.map((it, idx) => (
            <Li key={idx}>{renderInline(it)}</Li>
          ))}
        </Ul>
      );
    case "code":
      return block.tabs.length > 0 ? <CodeWindow key={key} className="mt-6" tabs={block.tabs} /> : null;
    case "callout":
      return (
        <Callout key={key} variant={block.variant}>
          {block.blocks.map((b, idx) => renderBlock(b, idx))}
        </Callout>
      );
    case "table":
      return (
        <Table
          key={key}
          head={block.head.map((cell) => renderInline(cell))}
          rows={block.rows.map((row) => row.map((cell) => renderInline(cell)))}
        />
      );
    case "diagram":
      return <Diagram key={key} id={block.id} />;
    case "hr":
      return <Hr key={key} />;
  }
}

export function MarkdownContent({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>;
}
