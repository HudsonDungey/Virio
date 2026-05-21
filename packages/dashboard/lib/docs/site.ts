/** Canonical site origin used for metadata, sitemap, and JSON-LD. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://virio.xyz").replace(
  /\/$/,
  "",
);

export const SITE_NAME = "Virio";
