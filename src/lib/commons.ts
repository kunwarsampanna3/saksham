import { createHash } from "node:crypto";

/** Direct upload.wikimedia.org URL for a Commons file name (served through next/image, so the browser only talks to us). */
export function commonsUrl(fileName: string): string {
  const name = fileName.replace(/ /g, "_");
  const h = createHash("md5").update(name).digest("hex");
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}`;
}

export const commonsPage = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`;

/** Standard-size Commons thumbnail (for review only). */
export function commonsThumb(fileName: string, width = 330): string {
  const name = fileName.replace(/ /g, "_");
  const h = createHash("md5").update(name).digest("hex");
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}/${width}px-${encodeURIComponent(name)}`;
}
