// Applies all pending SQL migrations from supabase/migrations to the Supabase
// database, in file-name order, each in its own transaction.
// Usage: npm run db:migrate  (needs SUPABASE_DB_URL in .env.local)
import { lookup } from "node:dns/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const configuredUrl = process.env.SUPABASE_DB_URL?.trim();
if (!configuredUrl) {
  console.error("SUPABASE_DB_URL fehlt in .env.local (siehe README, Abschnitt „Datenbank einrichten“).");
  process.exit(1);
}

const migrationsDir = join(import.meta.dirname, "..", "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

// Supabase's session pooler, tried in this order when the direct host
// (IPv6 only) cannot be reached. Frankfurt first, as the README recommends.
const POOLER_REGIONS = ["eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "us-east-1", "us-west-1"];
const POOLER_PREFIXES = ["aws-0", "aws-1"];

const connect = (url: string) =>
  // prepare: false is required by Supabase's connection pooler.
  postgres(url, { ssl: "require", prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });

/** Uses the configured URL, or derives a session-pooler URL if the direct host is unreachable. */
async function openConnection(): Promise<postgres.Sql> {
  const url = new URL(configuredUrl!);
  const ref = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  const directReachable = await lookup(url.hostname).then(() => true, () => false);
  if (!ref || directReachable) return connect(configuredUrl!);

  console.log("Direkte Verbindung (nur IPv6) nicht erreichbar, nutze den Session Pooler …");
  for (const prefix of POOLER_PREFIXES) {
    for (const region of POOLER_REGIONS) {
      const pooler = new URL(configuredUrl!);
      pooler.hostname = `${prefix}-${region}.pooler.supabase.com`;
      pooler.port = "5432";
      pooler.username = `postgres.${ref}`;
      const sql = connect(pooler.toString());
      try {
        await sql`select 1`;
        console.log(`Verbunden über ${pooler.hostname}`);
        return sql;
      } catch (error) {
        await sql.end({ timeout: 1 });
        const message = error instanceof Error ? error.message : String(error);
        // Wrong region answers "Tenant or user not found"; anything else is a real error.
        if (!/tenant or user not found|ENOTFOUND/i.test(message)) throw error;
      }
    }
  }
  throw new Error("Kein Session Pooler für dieses Projekt gefunden. Bitte die Session-Pooler-Adresse aus Supabase → Connect eintragen.");
}

const sql = await openConnection().catch((error: unknown) => {
  console.error(`Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

try {
  // Bookkeeping lives in its own schema, which the Data API does not expose.
  await sql`create schema if not exists app_private`;
  await sql`
    create table if not exists app_private.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

  const applied = new Set((await sql`select name from app_private.schema_migrations`).map((r) => r.name as string));
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`Alles aktuell (${files.length} Migrationen bereits eingespielt).`);
  }
  for (const file of pending) {
    const content = readFileSync(join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into app_private.schema_migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
  }

  // Make the new tables visible to the Data API right away.
  await sql`notify pgrst, 'reload schema'`;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration fehlgeschlagen: ${message}`);
  console.error("Die fehlgeschlagene Migration wurde vollständig zurückgerollt.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
