import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VirioConfig } from "./types";

let cached: VirioConfig | null = null;

export function getVirioConfig(): VirioConfig {
  if (cached) return cached;
  const path = join(process.cwd(), "virio.config.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as VirioConfig;
  return cached;
}
