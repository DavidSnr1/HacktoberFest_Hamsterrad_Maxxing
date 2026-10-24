// RLS tests for feature C (jobs). Self-contained: bootstraps a minimal Supabase-like environment
// in PGlite and applies only the *_jobs_*.sql migrations.
// Run: node --test supabase/tests/jobs.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

const BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to service_role;
`;

let db;

async function as(role, userId, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function rejects(promise, pattern = /permission denied|row-level security/) {
  await assert.rejects(promise, (error) => pattern.test(error.message));
}

before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_jobs_.*\.sql$/.test(name))
    .sort();
  assert.ok(files.length >= 3, "jobs migrations found");
  for (const file of files) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));

  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');`);
  await as("service_role", null, () =>
    db.exec(`
      insert into public.job_postings (id, source, source_id, source_url, title)
      values ('10000000-0000-0000-0000-000000000001', 'test', '1', 'https://example.com/1', 'Praktikum A'),
             ('10000000-0000-0000-0000-000000000002', 'test', '2', 'https://example.com/2', 'Praktikum B');
    `),
  );
});

after(async () => {
  await db?.close();
});

describe("job_postings", () => {
  it("is readable for signed-in users", async () => {
    const { rows } = await as("authenticated", USER_A, () => db.query("select id from public.job_postings"));
    assert.equal(rows.length, 2);
  });

  it("is not readable for anon", async () => {
    await rejects(as("anon", null, () => db.query("select id from public.job_postings")));
  });

  it("is not writable for signed-in users", async () => {
    await rejects(
      as("authenticated", USER_A, () =>
        db.query(
          "insert into public.job_postings (source, source_id, source_url, title) values ('x', 'y', 'https://x.y', 'z')",
        ),
      ),
    );
    await rejects(as("authenticated", USER_A, () => db.query("update public.job_postings set title = 'hacked'")));
  });

  it("enforces unique (source, source_id)", async () => {
    await assert.rejects(
      as("service_role", null, () =>
        db.query(
          "insert into public.job_postings (source, source_id, source_url, title) values ('test', '1', 'https://x.y', 'dup')",
        ),
      ),
      /duplicate key/,
    );
  });
});

describe("saved_jobs", () => {
  it("lets users save and see only their own jobs", async () => {
    await as("authenticated", USER_A, () =>
      db.query("insert into public.saved_jobs (job_id) values ('10000000-0000-0000-0000-000000000001')"),
    );
    await as("authenticated", USER_B, () =>
      db.query("insert into public.saved_jobs (job_id) values ('10000000-0000-0000-0000-000000000002')"),
    );

    const a = await as("authenticated", USER_A, () => db.query("select user_id, job_id from public.saved_jobs"));
    assert.deepEqual(
      a.rows.map((row) => row.user_id),
      [USER_A],
    );
    const anon = as("anon", null, () => db.query("select * from public.saved_jobs"));
    await rejects(anon);
  });

  it("does not allow saving for another user", async () => {
    await rejects(
      as("authenticated", USER_A, () =>
        db.query(
          `insert into public.saved_jobs (user_id, job_id) values ('${USER_B}', '10000000-0000-0000-0000-000000000001')`,
        ),
      ),
    );
  });

  it("does not let users delete other users' rows", async () => {
    await as("authenticated", USER_A, () => db.query("delete from public.saved_jobs"));
    const { rows } = await as("service_role", null, () => db.query("select user_id from public.saved_jobs"));
    assert.deepEqual(
      rows.map((row) => row.user_id),
      [USER_B],
    );
  });

  it("is removed when the user is deleted", async () => {
    await db.exec(`delete from auth.users where id = '${USER_B}';`);
    const { rows } = await as("service_role", null, () => db.query("select * from public.saved_jobs"));
    assert.equal(rows.length, 0);
  });
});

describe("job_search_cache", () => {
  it("is not accessible for signed-in users", async () => {
    await rejects(as("authenticated", USER_A, () => db.query("select * from public.job_search_cache")));
  });
});

describe("job_outlook_cache", () => {
  it("is not accessible for signed-in users", async () => {
    await rejects(as("authenticated", USER_A, () => db.query("select * from public.job_outlook_cache")));
  });

  it("is writable for the service role", async () => {
    await as("service_role", null, () =>
      db.query(`insert into public.job_outlook_cache (cache_key, outlook) values ('k', '{"hint":"x"}')`),
    );
  });
});

describe("job_postings insights columns", () => {
  it("default to empty values", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query("select snippet, insights, detail_insights, details_fetched_at from public.job_postings limit 1"),
    );
    assert.deepEqual(rows[0], { snippet: "", insights: {}, detail_insights: {}, details_fetched_at: null });
  });
});

describe("job_search_events", () => {
  it("only exposes the user's own events", async () => {
    await db.exec(`insert into auth.users (id) values ('${USER_B}') on conflict do nothing;`);
    await as("authenticated", USER_A, () => db.query("insert into public.job_search_events default values"));
    await as("authenticated", USER_B, () => db.query("insert into public.job_search_events default values"));
    const { rows } = await as("authenticated", USER_A, () => db.query("select user_id from public.job_search_events"));
    assert.deepEqual(
      rows.map((row) => row.user_id),
      [USER_A],
    );
  });

  it("cannot be inserted for another user", async () => {
    await rejects(
      as("authenticated", USER_A, () =>
        db.query(`insert into public.job_search_events (user_id) values ('${USER_B}')`),
      ),
    );
  });
});
