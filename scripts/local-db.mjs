// Local verification harness for StudyLab SQL migrations.
// Boots an embedded PostgreSQL instance, creates minimal Supabase stubs
// (auth schema, storage tables) and applies supabase/migrations/*.sql in order.
//
// Usage:
//   npm run db:verify               # fresh DB, apply all migrations, run RLS sanity checks
//   node scripts/local-db.mjs --query "select count(*) from public.topics"
//
// This is a dev-only verification tool. It is NOT the runtime environment:
// production always uses a real Supabase project where auth/storage exist natively.

import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
// Overridable so the generated single-file bundle (npm run db:bundle) can be
// verified through this same gate:
//   STUDYLAB_MIGRATIONS_DIR=.local-pg/bundle npm run db:verify
const MIGRATIONS_DIR = process.env.STUDYLAB_MIGRATIONS_DIR
  ? resolve(ROOT, process.env.STUDYLAB_MIGRATIONS_DIR)
  : join(ROOT, "supabase", "migrations");
const DATA_DIR = join(ROOT, ".local-pg");
const PORT = 54329;
const DB_NAME = "studylab_verify";
const USER = "studylab";

const STUBS = `
-- Minimal Supabase stubs so migrations referencing auth.* / storage.* can be verified.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select null::jsonb
$$;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
`;

function sqlFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main() {
  const wantQuery = process.argv.includes("--query");

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: "studylab",
    port: PORT,
    authMethod: "password",
    persistent: true,
    onLog: () => {},
    onError: (m) => console.error("[pg]", m),
  });

  const fresh = !existsSync(join(DATA_DIR, "PG_VERSION"));
  if (!wantQuery) {
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  if (fresh || !existsSync(join(DATA_DIR, "PG_VERSION"))) {
    console.log("[db] initialising embedded postgres ...");
    await pg.initialise();
  }
  await pg.start();

  if (wantQuery) {
    const q = process.argv[process.argv.indexOf("--query") + 1];
    const client = pg.getPgClient(DB_NAME, "127.0.0.1");
    await client.connect();
    const res = await client.query(q);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
    await pg.stop();
    return;
  }

  const admin = pg.getPgClient("postgres", "127.0.0.1");
  await admin.connect();
  await pg.createDatabase(DB_NAME);

  const client = pg.getPgClient(DB_NAME, "127.0.0.1");
  await client.connect();

  console.log("[db] applying Supabase stubs ...");
  await client.query(STUBS);

  for (const file of sqlFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[db] applying ${file} ...`);
    try {
      await client.query(sql);
    } catch (err) {
      console.error(`[db] FAILED: ${file}\n${err.message}`);
      await client.end();
      await admin.end();
      await pg.stop();
      process.exit(1);
    }
    console.log(`[db] ok: ${file}`);
  }

  const counts = await client.query(`
    select (select count(*) from public.courses) as courses,
           (select count(*) from public.topics) as topics,
           (select count(*) from pg_policies where schemaname = 'public') as policies
  `);
  console.log("[db] sanity:", counts.rows[0]);

  const rls = await client.query(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  const missing = rls.rows.filter((r) => !r.rls_enabled).map((r) => r.table_name);
  if (missing.length > 0) {
    console.error(`[db] RLS NOT ENABLED on: ${missing.join(", ")}`);
    await client.end();
    await admin.end();
    await pg.stop();
    process.exit(1);
  }
  console.log(`[db] RLS enabled on all ${rls.rows.length} public tables`);

  await client.end();
  await admin.end();
  await pg.stop();
  console.log("[db] all migrations verified OK");
}

main().catch((err) => {
  console.error("[db] harness error:", err);
  process.exit(1);
});
