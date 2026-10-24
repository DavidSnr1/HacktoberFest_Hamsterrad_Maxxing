// Applies all migrations to an in-memory Postgres (PGlite) with a minimal
// Supabase auth stub and checks RLS, privileges and constraints.
// Run with: npm run db:test
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(import.meta.dirname, "..", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"));
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Mirror Supabase's default privileges on new public tables.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
for (const sql of migrations) await db.exec(sql);
await db.exec(`grant all on all tables in schema public to service_role;`);

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email) values ('${A}','a@test'),('${B}','b@test');`);

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

async function as(role, uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try { return { rows: (await db.query(sql)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec("reset role;"); }
}

// Trigger created profiles
const profiles = await db.query("select id from public.profiles order by id");
check("trigger creates a profile per user", profiles.rows.length === 2);

// Data for A
let r = await as("authenticated", A, `insert into interviews (track) values ('consulting') returning id, user_id`);
check("A can insert interview (user_id defaults to auth.uid())", r.rows?.[0]?.user_id === A);
const interviewA = r.rows[0].id;
r = await as("authenticated", A, `insert into resumes (original_text) values ('cv') returning id`);
const resumeA = r.rows[0].id;
await as("authenticated", A, `insert into consents (type, policy_version) values ('voice','2026-10-24')`);

// Isolation
r = await as("authenticated", B, `select * from interviews`);
check("B cannot see A's interviews", r.rows.length === 0);
r = await as("authenticated", B, `select * from profiles`);
check("B sees only own profile", r.rows.length === 1 && r.rows[0].id === B);
r = await as("authenticated", B, `update interviews set status='aborted' where id='${interviewA}' returning id`);
check("B cannot update A's interview", r.rows?.length === 0);
r = await as("authenticated", B, `delete from resumes where id='${resumeA}' returning id`);
check("B cannot delete A's resume", r.rows?.length === 0);
r = await as("authenticated", B, `insert into interviews (user_id, track) values ('${A}','finance')`);
check("B cannot insert rows for A", Boolean(r.error));
r = await as("authenticated", B, `insert into tailored_resumes (resume_id, job_posting_text, result) values ('${resumeA}','job','{}')`);
check("B cannot tailor A's resume", Boolean(r.error));
r = await as("authenticated", A, `insert into tailored_resumes (resume_id, job_posting_text, result) values ('${resumeA}','job','{}') returning id`);
check("A can tailor own resume", r.rows?.length === 1);

// Server-only tables
r = await as("authenticated", A, `insert into xp_events (user_id, type, amount) values ('${A}','daily_streak',10)`);
check("A cannot write own XP events", Boolean(r.error));
r = await as("authenticated", A, `insert into interview_feedback (interview_id, scores) values ('${interviewA}','{}')`);
check("A cannot write feedback", Boolean(r.error));
r = await as("service_role", null, `insert into interview_feedback (interview_id, scores) values ('${interviewA}','{}') returning id`);
check("service role can write feedback", r.rows?.length === 1);
r = await as("service_role", null, `insert into xp_events (user_id, type, amount, ref_id) values ('${A}','interview_finished',50,'${interviewA}') returning id`);
check("service role can write XP", r.rows?.length === 1);
r = await as("service_role", null, `insert into xp_events (user_id, type, amount, ref_id) values ('${A}','interview_finished',50,'${interviewA}')`);
check("duplicate XP for same item is rejected", Boolean(r.error));
r = await as("authenticated", A, `select * from interview_feedback`);
check("A can read own feedback", r.rows?.length === 1);
check("feedback has an exercise column (default '')", r.rows?.[0]?.exercise === "");
r = await as("authenticated", B, `select * from interview_feedback`);
check("B cannot read A's feedback", r.rows?.length === 0);
r = await as("authenticated", A, `select sum(amount)::int as xp from xp_events`);
check("A can read own XP", r.rows?.[0]?.xp === 50);
r = await as("authenticated", B, `select * from xp_events`);
check("B cannot read A's XP", r.rows?.length === 0);

r = await as("authenticated", A, `select has_table_privilege('authenticated', 'public.xp_events', 'INSERT') as can`);
check("authenticated has no INSERT privilege on xp_events", r.rows?.[0]?.can === false);
r = await as("authenticated", A, `select public.handle_new_user()`);
check("users cannot call the trigger function", Boolean(r.error));

// Anonymous access
r = await as("anon", null, `select * from interviews`);
check("anon has no table access", Boolean(r.error));

// Constraints
r = await as("authenticated", A, `insert into interviews (track) values ('marketing')`);
check("invalid track rejected", Boolean(r.error));
r = await as("authenticated", A, `insert into consents (type, policy_version) values ('voice','v2')`);
check("duplicate consent per type rejected (use upsert)", Boolean(r.error));
r = await as("authenticated", A, `insert into consents (type, policy_version) values ('voice','v2') on conflict (user_id, type) do update set policy_version = excluded.policy_version, granted_at = now() returning policy_version`);
check("consent upsert works", r.rows?.[0]?.policy_version === "v2");

// Cascade delete
await db.exec(`delete from auth.users where id='${A}'`);
const left = await db.query(`
  select (select count(*) from interviews) + (select count(*) from interview_feedback) + (select count(*) from resumes)
       + (select count(*) from tailored_resumes) + (select count(*) from xp_events) + (select count(*) from consents)
       + (select count(*) from profiles where id='${A}') as n`);
check("deleting the user removes all their data", Number(left.rows[0].n) === 0);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
