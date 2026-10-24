// RLS tests for feature A (resumes). Self-contained: bootstraps a minimal Supabase-like environment
// in PGlite and applies only the *_resume_*.sql migrations.
// Run: node --test supabase/tests/cv-tailoring.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const DOC_A = "20000000-0000-0000-0000-00000000000a";
const DOC_B = "20000000-0000-0000-0000-00000000000b";
const DOC_C = "20000000-0000-0000-0000-00000000000c";
const DOC_D = "20000000-0000-0000-0000-00000000000d";

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

function insertDocument(id, track = "consulting") {
  return db.query(
    "insert into public.resume_documents (id, track, target_role) values ($1, $2, 'Werkstudent Strategy') returning user_id",
    [id, track],
  );
}

function insertVersion(documentId, version, status = "accepted") {
  return db.query(
    "insert into public.resume_versions (document_id, version, content, status) values ($1, $2, '{}'::jsonb, $3)",
    [documentId, version, status],
  );
}

before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_resume_.*\.sql$/.test(name))
    .sort();
  assert.ok(files.length >= 1, "resume migrations found");
  for (const file of files) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));

  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');`);
  await as("authenticated", USER_A, async () => {
    await insertDocument(DOC_A);
    await insertVersion(DOC_A, 1);
  });
  await as("authenticated", USER_B, async () => {
    await insertDocument(DOC_B);
    await insertVersion(DOC_B, 1);
  });
});

after(async () => {
  await db?.close();
});

describe("resume_documents", () => {
  it("sets user_id from the session", async () => {
    const { rows } = await as("service_role", null, () =>
      db.query("select user_id from public.resume_documents where id = $1", [DOC_A]),
    );
    assert.equal(rows[0].user_id, USER_A);
  });

  it("users only see their own resumes", async () => {
    const { rows } = await as("authenticated", USER_B, () => db.query("select id from public.resume_documents"));
    assert.deepEqual(
      rows.map((r) => r.id),
      [DOC_B],
    );
  });

  it("anon sees nothing", async () => {
    await rejects(as("anon", null, () => db.query("select id from public.resume_documents")));
  });

  it("users cannot insert resumes for someone else", async () => {
    await rejects(
      as("authenticated", USER_A, () =>
        db.query("insert into public.resume_documents (user_id, track, target_role) values ($1, 'finance', 'x')", [USER_B]),
      ),
    );
  });

  it("users cannot update or delete foreign resumes", async () => {
    const updated = await as("authenticated", USER_A, () =>
      db.query("update public.resume_documents set target_role = 'hacked' where id = $1", [DOC_B]),
    );
    assert.equal(updated.affectedRows, 0);
    const deleted = await as("authenticated", USER_A, () =>
      db.query("delete from public.resume_documents where id = $1", [DOC_B]),
    );
    assert.equal(deleted.affectedRows, 0);
  });

  it("users cannot hand their resume to someone else", async () => {
    await rejects(
      as("authenticated", USER_A, () =>
        db.query("update public.resume_documents set user_id = $1 where id = $2", [USER_B, DOC_A]),
      ),
    );
  });

  it("allows only one resume per track and user", async () => {
    await rejects(
      as("authenticated", USER_A, () => insertDocument(DOC_C, "consulting")),
      /duplicate key|unique/,
    );
  });

  it("allows the same track for different users and other tracks for the same user", async () => {
    const { rows } = await as("service_role", null, () =>
      db.query("select count(*)::int as n from public.resume_documents where track = 'consulting'"),
    );
    assert.equal(rows[0].n, 2);
    await as("authenticated", USER_A, () => insertDocument(DOC_C, "finance"));
  });

  it("rejects unknown tracks", async () => {
    await rejects(
      as("authenticated", USER_A, () => insertDocument(DOC_D, "marketing")),
      /check constraint/,
    );
  });

  it("touches updated_at on update", async () => {
    const before = await as("service_role", null, () =>
      db.query("select updated_at from public.resume_documents where id = $1", [DOC_A]),
    );
    await as("authenticated", USER_A, () =>
      db.query("update public.resume_documents set active_version = 1 where id = $1", [DOC_A]),
    );
    const after = await as("service_role", null, () =>
      db.query("select updated_at from public.resume_documents where id = $1", [DOC_A]),
    );
    assert.ok(after.rows[0].updated_at >= before.rows[0].updated_at);
  });
});

describe("resume_versions", () => {
  it("users only see their own versions", async () => {
    const { rows } = await as("authenticated", USER_B, () => db.query("select document_id from public.resume_versions"));
    assert.deepEqual(
      rows.map((r) => r.document_id),
      [DOC_B],
    );
  });

  it("users cannot add versions to foreign resumes", async () => {
    await rejects(as("authenticated", USER_A, () => insertVersion(DOC_B, 2)));
  });

  it("version numbers are unique per resume", async () => {
    await rejects(
      as("authenticated", USER_A, () => insertVersion(DOC_A, 1)),
      /duplicate key|unique/,
    );
  });

  it("allows only one open draft per resume", async () => {
    await as("authenticated", USER_A, () => insertVersion(DOC_A, 2, "draft"));
    await rejects(
      as("authenticated", USER_A, () => insertVersion(DOC_A, 3, "draft")),
      /duplicate key|unique/,
    );
  });

  it("rejects unknown statuses", async () => {
    await rejects(
      as("authenticated", USER_A, () => insertVersion(DOC_A, 9, "published")),
      /check constraint/,
    );
  });
});

describe("deletion", () => {
  it("deleting a resume deletes its versions", async () => {
    await as("authenticated", USER_B, () => db.query("delete from public.resume_documents where id = $1", [DOC_B]));
    const { rows } = await as("service_role", null, () =>
      db.query("select count(*)::int as n from public.resume_versions where document_id = $1", [DOC_B]),
    );
    assert.equal(rows[0].n, 0);
  });

  it("deleting a user deletes everything", async () => {
    await db.exec(`delete from auth.users where id = '${USER_A}';`);
    const { rows } = await as("service_role", null, () =>
      db.query(
        "select (select count(*) from public.resume_documents)::int as docs, (select count(*) from public.resume_versions)::int as versions",
      ),
    );
    assert.deepEqual(rows[0], { docs: 0, versions: 0 });
  });
});
