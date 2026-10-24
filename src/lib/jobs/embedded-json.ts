// Helpers to read structured data that job portals embed in their HTML pages.

// Returns the JSON object or array literal that starts right after `marker` (e.g. `window.__STATE__ = `).
export function extractJsonAfter(html: string, marker: string | RegExp): unknown | null {
  let start: number;
  if (typeof marker === "string") {
    const index = html.indexOf(marker);
    if (index === -1) return null;
    start = index + marker.length;
  } else {
    const match = marker.exec(html);
    if (!match) return null;
    start = match.index + match[0].length;
  }
  while (start < html.length && /\s/.test(html[start] ?? "")) start++;
  const literal = sliceBalanced(html, start);
  if (!literal) return null;
  try {
    return JSON.parse(literal);
  } catch {
    return null;
  }
}

// Finds the end of a JSON object/array starting at `start`, honouring strings and escapes.
function sliceBalanced(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// All schema.org JSON-LD blocks of a page, flattened (handles arrays and @graph).
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const data: unknown = JSON.parse(match[1] ?? "");
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!isRecord(item)) continue;
        const graph = item["@graph"];
        if (Array.isArray(graph)) blocks.push(...graph.filter(isRecord));
        else blocks.push(item);
      }
    } catch {
      // Ignore malformed blocks.
    }
  }
  return blocks;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Heuristic for bot-protection interstitials (captcha, JS challenge). We report these, never bypass them.
export function looksLikeBotChallenge(html: string): boolean {
  return /captcha|security check|cf-challenge|challenge-platform|are you a robot|bist du ein mensch|_0x[0-9a-f]{4,}/i.test(
    html.slice(0, 20_000),
  );
}
