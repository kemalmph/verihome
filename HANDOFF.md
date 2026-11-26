# Handoff — read this with AGENTS.md

Written 2026-11-21. Point of this file: a new session starts cold, and the
things that matter most here are not visible from the code.

## Where to start

1. `AGENTS.md` — the rules. Note especially that the system reference is
   **read-only to you**.
2. The system reference: https://claude.ai/artifact/B9WY3ErwkBzWGoY7WRkmJf
   Section numbers in commits and in this file point at it.
3. This file, for what has moved since.

## Open, and waiting on the owner

**Credential rotation.** There is an outstanding credential rotation the owner
knows about. It is the most urgent item here and nothing in the repository
fixes it. Ask before assuming it is done; do not write the details into any
file in this repository.

**Decisions not yet made** (all of them the owner's, not yours):
- The seven properties all fail the publish checklist. Six are live and would
  be refused if re-published. Do not change `properties.status`.
- The end-to-end deposit test left a real attended viewing (`e6288fa2`) and a
  live 50.000 credit owned by a `@test.invalid` account. Ledger entries are
  immutable, so a correction is reversing entries, never UPDATE or DELETE.
- `VIEWING_DEPOSIT_AMOUNT` in Vercel is unverified. The code defaults to 50000
  in all three places it is read, and all three are server-side, so there is no
  client/server mismatch — the only question is the value in Vercel.
- §20.1 Tally webhook: set `TALLY_SIGNING_SECRET` or delete the route.
- Owner portal is built and isolation-tested (25/25) but no real owner has
  been invited.

## §20.4 — CLOSED on 2026-11-21

The migration history now builds the database from nothing. `supabase db reset`
runs clean.

**What it was.** Fifteen of the 26 tables were made through the Supabase
dashboard and never written down, so `001_booking_system.sql` opened with
`ALTER TABLE properties` against a table nothing created. A replay into an
empty Postgres 17 failed on the first file.

**What was done.** The 42 files moved to `supabase/migrations-archive/`, and a
single `00000000000000_baseline.sql` replaced them. The baseline was read out
of production's system catalogs, not written by hand.

**How it was checked** — six gates, all passed, in this order:
1. `supabase db reset` from zero — clean.
2. `scripts/check-migration-completeness.js` with no flag — full pass, and
   `KNOWN_MISSING` in that script is now empty. A planted regression still
   makes it exit non-zero, so it has not been defanged.
3. `scripts/audit-anon-exposure.js --verify` against the rebuilt database with
   the data loaded — 0 flagged. Run against an empty database this check is
   hollow, because it reads what `select=*` actually returns; the data was
   loaded first on purpose.
4. Directly: `anon` gets 42501 on `properties` for both `select=*` and
   `select=name,address`, while `select=name,area,price_monthly` returns the
   live listings. Same behaviour as production (§19.12, §19.13).
5. Census against production — identical on all ten dimensions: 26 tables,
   340 columns, 54 foreign keys, 48 checks, 62 indexes, 17 policies, 38
   functions, 7 triggers, 3 generated columns, 26 tables with RLS.
6. Exactly one version of every function in `pg_proc`.

**Three things the replay caught that reading the catalogs did not:**
- Column defaults need `search_path` to include `extensions`, or the first
  `CREATE TABLE` fails on `uuid_generate_v4()`.
- `bookings.nights`, `property_media.total_photo_count` and
  `rla_assessments.rla_score` are **STORED generated columns**, not defaults.
  Rendered as defaults they produce a database that looks right and silently
  stops computing.
- The system reference says two triggers sit on `auth.users`. One does
  (`on_auth_user_created`); `trg_set_admin_flag` is on `public.users`.

### ⚠ Phase B is NOT done: never run `supabase db push`

Production's `supabase_migrations.schema_migrations` still lists the 48
timestamp-named migrations it actually ran. It knows nothing about the
baseline, so a `db push` would read the baseline as unapplied and try to
`CREATE TABLE` against the live, populated database.

Reconciling it needs `supabase link` plus `supabase migration repair`, which
needs the database password — the owner's step, not yours. Until it is done,
`db reset` against the local stack is safe and is the command you want;
`db push` is the one to stay away from. `supabase/migrations-archive/README.md`
carries the same warning and the evidence behind it.

## Environment

Sessions can run on the **Default** cloud environment. As of 2026-11-26 the
owner confirms Default is ready for this project (Verihome / Cosystem) too, not
only for Pasarin, so there is no need to pick a special environment. An
environment named `verihome` (`env_019h1qiey4NpoNWKsHFsY7So`) also exists — it
allows the Supabase host and its setup script installs dependencies, the
Supabase CLI and starts Docker — but it is optional. A running session cannot
switch environments. If something this project needs is missing in the session
(dependencies, Supabase CLI, Docker, network access to the Supabase host),
install it or report what is missing instead of assuming.

**Supabase connector**: resolved 2026-11-21, and no longer something you have
to work around. The `verihome` project was transferred from `malgrown dev` into `maldev`, so
both projects now sit in one organization and one grant reaches both. Verified
from a single session: `verihome` (`hxktoewssuahtkrksbpx`) and `pasarin`
(`acwksgoziqenaqqnzhtk`) are both listed and both queryable. The transfer
changed no data and did not change the project ref, so every Vercel variable,
API key and URL kept working.

The constraint behind it still holds and is worth knowing: **one OAuth grant
reaches exactly one organization**, and granting a second revokes the first.
If a future project lands in a different org, that is the trap — the fix is to
move the project, not to reconnect.

Pasarin's database is readable from here as a side effect. It is a different
product; leave it alone unless asked.

## Smaller things worth knowing

- **Photos are stored as absolute URLs, not object keys** — `upload/route.ts`
  saves what `uploadToR2` returns into `property_media.photos_*`, and
  `keyFromUrl` recovers a key by stripping the `R2_PUBLIC_URL` prefix, falling
  back to returning the whole URL when it does not match. So changing the R2
  public URL 404s every photo *and* makes deletes silently target a bogus key.
  Payment proofs do store keys (§11); photos are the exception.
- **The product is now Cosystem.** The rename landed on 2026-11-21 and is
  brand-only: no behaviour, schema or data changed, and the property rental
  marketplace works exactly as before. It was applied once (`f70c836`),
  reverted at the owner's request (`1e5e01a`), then re-applied.

  Four things still say "verihome" on purpose, so do not "fix" them:
  the Supabase project and its ref `hxktoewssuahtkrksbpx`, which cannot be
  renamed; the R2 buckets `verihome-media` and `verihome-private`, for the
  reason in the photo-URL note above; the applied migration files, which are
  history; and the system reference's own title, which `AGENTS.md` cites.
- `supabase/.temp/cli-latest` is untracked now; the CLI rewrites it on every
  run and it made every session report a dirty tree.
- Pre-existing eslint error in `BuildListingPageClient.tsx:141` (setState inside
  an effect). Not caused by recent work, still open.
- **Never put an event handler in a server component.** Two admin pages had
  `onClick={… confirm() …}` on a submit button inside a server component;
  Next.js cannot serialize it, so it threw while rendering and both routes
  returned **500 — no page at all**, not a button that failed to warn. Fixed
  2026-11-21 with one client component, `src/components/ui/ConfirmSubmitButton.tsx`.
  Use it rather than writing the inline version again. The grep that finds a
  recurrence:

      for f in $(grep -rl "onClick=\|onChange=\|onSubmit=" src --include=*.tsx); do
        head -3 "$f" | grep -q '"use client"' || echo "$f"
      done

## Fixed: the listing route's rendering mode was decided by build-time data

`/listings/[slug]` carried `revalidate = 60` and a `generateStaticParams`, and
also calls `getSavedPropertyIds()`, which reads cookies. With `dynamic` left at
its default `'auto'`, that made the rendering mode depend on what was in the
database when the build ran:

- **live listings present** — Next.js attempts a prerender, discovers the
  cookie read, marks the route dynamic (`f`). Works. This is what production
  built, which is why nothing was ever broken there.
- **no live listings** — `generateStaticParams` returns `[]`, nothing is
  rendered, the cookie read is never discovered, the route stays static
  (`●`). Every request then throws `DYNAMIC_SERVER_USAGE`: 500 on every
  listing page, and 500 where a 404 belonged.

Both reproduced on 2026-11-21. Fixed by `export const dynamic = "force-dynamic"`,
which is what production already did, now stated instead of inferred.
`revalidate` and `generateStaticParams` are gone; `getLiveSlugs()` is kept for
a future sitemap and says so.

**I first reported this as a live production bug. It was not** — production's
build takes the working branch. The fragility was real, the breakage was not.

If these pages should be prerendered for SEO, the cookie read has to move to
the client first (`SaveButton` fetching its own saved state), and only then can
the route go back to ISR. That is a real change with its own tests, not a
config line, and it is still open.

## Tests

Both need the local stack, a built app, and an admin account the caller
creates (`admin@verihome.id` is granted `superadmin` in `staff_roles` by the
`set_admin_flag` trigger — Phase 1, 2026-11-26; `users.is_admin` is no longer read):

    dockerd &                       # dies most sessions; restart it
    npx supabase start && npx supabase db reset
    # seed admin via auth.admin.createUser, then:
    npm run build && npm run start
    NODE_PATH=/opt/node-tools/node_modules node scripts/test-coworking-admin.js   # 33 checks
    NODE_PATH=/opt/node-tools/node_modules node scripts/test-publish-gate.js      # 6 checks
    NODE_PATH=/opt/node-tools/node_modules node scripts/test-listing-render-mode.js  # 4 checks

Run the last one twice: once after a build made with no live listings, once
after a build made with one present. Both must pass — that is the whole
point of it, and before the fix the first run failed.

`test-publish-gate.js` was A/B'd against the gate removed and correctly failed,
so it detects the bug's return rather than merely passing today.

## Branch

Work happens on `main-g2jjf1`. `main` is level with it as of `f1aca50`.
