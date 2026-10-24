import "server-only";

// Honest, identifiable user agent. We never pretend to be a browser or another app.
export const JOBS_USER_AGENT = "hamsterrad-maxxing/0.1 (Studierendenprojekt; nicht-kommerziell)";

const DEFAULT_TIMEOUT_MS = 8_000;
// Minimum gap between two requests to the same host (best effort, per server instance).
const MIN_HOST_GAP_MS = 1_000;

export class SourceError extends Error {
  constructor(
    message: string,
    readonly reason: "blocked" | "http" | "timeout" | "parse",
  ) {
    super(message);
    this.name = "SourceError";
  }
}

const lastRequestByHost = new Map<string, number>();

async function waitForHostSlot(host: string, signal: AbortSignal) {
  const now = Date.now();
  const nextAllowed = (lastRequestByHost.get(host) ?? 0) + MIN_HOST_GAP_MS;
  const wait = Math.max(0, nextAllowed - now);
  lastRequestByHost.set(host, now + wait);
  if (wait === 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new SourceError("Zeitüberschreitung", "timeout"));
      },
      { once: true },
    );
  });
}

type FetchOptions = {
  signal: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

async function request(url: string, { signal, headers, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions): Promise<Response> {
  const host = new URL(url).host;
  const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  await waitForHostSlot(host, combined);

  let lastError: unknown;
  // One retry on network errors and 5xx, nothing else.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: combined,
        headers: { "User-Agent": JOBS_USER_AGENT, "Accept-Language": "de-DE,de;q=0.9", ...headers },
        cache: "no-store",
      });
      if (response.status === 403 || response.status === 429 || response.status === 999) {
        throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
      }
      if (response.status >= 500 && attempt === 0) {
        lastError = new SourceError(`HTTP ${response.status}`, "http");
        continue;
      }
      if (!response.ok) throw new SourceError(`HTTP ${response.status}`, "http");
      return response;
    } catch (error) {
      if (error instanceof SourceError) throw error;
      if (combined.aborted) throw new SourceError("Zeitüberschreitung", "timeout");
      lastError = error;
    }
  }
  throw lastError instanceof SourceError ? lastError : new SourceError("Netzwerkfehler", "http");
}

export async function fetchJson(url: string, options: FetchOptions): Promise<unknown> {
  const response = await request(url, { ...options, headers: { Accept: "application/json", ...options.headers } });
  try {
    return await response.json();
  } catch {
    throw new SourceError("Antwort ist kein gültiges JSON", "parse");
  }
}

export async function fetchHtml(url: string, options: FetchOptions): Promise<string> {
  const response = await request(url, { ...options, headers: { Accept: "text/html", ...options.headers } });
  return response.text();
}
