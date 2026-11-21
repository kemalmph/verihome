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

## §20.4 — the migration history cannot build the database

Still open, but much closer than the last handoff suggested.

**What is proven.** A clean replay of `supabase/migrations/` into an empty
Postgres 17 fails on the first file:
`ERROR: relation "properties" does not exist (SQLSTATE 42P01)`. Fifteen core
tables are created by no migration. This is executed, not inferred.

**What now exists in the repo:**
- `supabase/config.toml`, pinned to Postgres 17. `supabase db reset` works.
- `scripts/check-migration-completeness.js` — static guard, no Docker or
  production needed. Run `--baseline` before committing any migration; it
  fails if a new migration widens the gap.

**What was captured on 2026-11-21 and is NOT in this repo:**
A full reconstruction of the production schema, read from the live database's
catalogs and **verified by replaying it into an empty Postgres 17**. The
rebuilt database matches production exactly on tables, columns, foreign keys,
checks, indexes, policies, functions, triggers, generated columns and RLS.
The owner has those files. Ask for `verihome-schema.sql` before writing a
base-schema migration from scratch — most of the work is done.

Three things that replay caught and reading would not have:
- Column defaults need `search_path` to include `extensions`, or the first
  `CREATE TABLE` fails on `uuid_generate_v4()`.
- `bookings.nights`, `property_media.total_photo_count` and
  `rla_assessments.rla_score` are **STORED generated columns**, not defaults.
  Rendering them as defaults produces a database that looks right and silently
  stops computing.
- The system reference says there are two triggers on `auth.users`. There is
  one (`on_auth_user_created`). `trg_set_admin_flag` is on `public.users`.

**The remaining decision** is squash vs prepend. A baseline — whether from
`supabase db pull` or from the verified `verihome-schema.sql` above — already
contains everything migrations 001–042 did, so putting it *before* 001 means
those 42 then re-apply to a finished schema. Some are idempotent
(`IF NOT EXISTS`), some are not. Squash — the baseline becomes the only
migration and 001–042 move to an archive directory, with the history still in
git — is what Supabase's own docs point to, and is the standing recommendation.

**Deferred by the owner on 2026-11-21: do not start this unasked.** Access is
no longer the blocker, and the harness is ready, so it is a decision waiting
rather than work waiting. If you are about to add a migration in the meantime,
run `node scripts/check-migration-completeness.js --baseline` first — that is
what stops the gap getting wider while this sits.

## Environment

Sessions have run on the **Default** cloud environment, which is configured for
a different project (Pasarin) and has nothing for this one. An environment
named `verihome` exists (`env_019h1qiey4NpoNWKsHFsY7So`): it allows the Supabase
host and its setup script installs dependencies, the Supabase CLI and starts
Docker. Pick it in the environment menu — a running session cannot switch to it.

**Supabase connector**: resolved 2026-11-21, and no longer something you have
to work around. VeriHome was transferred from `malgrown dev` into `maldev`, so
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
- A rebrand to "Cosystem" was done and then reverted at the owner's request
  (`f70c836`, reverted by `1e5e01a`). The tree is back to VeriHome exactly.
- `supabase/.temp/cli-latest` is untracked now; the CLI rewrites it on every
  run and it made every session report a dirty tree.
- Pre-existing eslint error in `BuildListingPageClient.tsx:141` (setState inside
  an effect). Not caused by recent work, still open.

## Branch

Work happens on `main-g2jjf1`. `main` is behind it.
