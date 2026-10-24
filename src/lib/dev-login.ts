import "server-only";

/**
 * Addresses allowed to use the local direct sign-in (DEV_LOGIN_EMAILS, comma-separated).
 * Always empty outside `next dev`, so production builds never offer it.
 */
export function devLoginEmails(): string[] {
  if (process.env.NODE_ENV !== "development") return [];
  return (process.env.DEV_LOGIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
