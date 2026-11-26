/**
 * Seeds a LOCAL test superadmin. The admin@verihome.id email hook is gone
 * (migration 20261126180000), so the UI suites' admin account must be given its
 * role explicitly. Local only: it refuses to run against a non-local URL.
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY; optional SUPABASE_URL, ADMIN_EMAIL,
 * ADMIN_PASSWORD, DATABASE_URL. Never write the key to a file.
 */
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/127\.0\.0\.1|localhost/.test(SUPA)) { console.error("Refusing: SUPABASE_URL is not local."); process.exit(1); }
if (!SERVICE) { console.error("Set SUPABASE_SERVICE_ROLE_KEY (`npx supabase status`)."); process.exit(1); }

(async () => {
  const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });
  const db = new Client({ connectionString: DB }); await db.connect();
  let id = (await db.query("select id from users where email=$1", [EMAIL])).rows[0]?.id;
  if (!id) {
    const { data, error } = await svc.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(error.message);
    id = data.user.id;
    await db.query("insert into users(id, email, name) values ($1,$2,'Admin') on conflict (id) do nothing", [id, EMAIL]);
  }
  await db.query("insert into staff_roles(user_id, role) values ($1,'superadmin') on conflict do nothing", [id]);
  console.log(`superadmin ready: ${EMAIL}`);
  await db.end();
})().catch((e) => { console.error(e); process.exit(2); });
