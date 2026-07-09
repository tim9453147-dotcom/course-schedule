# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Run everything through `just` (read first)

The repo ships a `justfile` whose recipes pin fnm's Node (currently **v24.17.0**, see `justfile:3`) onto `PATH`, so `just dev` / `just deploy` / `just db-migrate-local` etc. always run under the right node — even from a clean/non-interactive shell. Run `just` with no args to list recipes; recipe names map to the package scripts (replace `:` with `-`, e.g. `just db-migrate-local` → `bun run db:migrate:local`). **Use `just`; don't worry about node version.**

Why it matters (only relevant if you bypass `just` and run `bun`/`bunx` directly): the machine's default `node` (`/usr/bin/node`) is **v18.19.1**, below Nuxt 4's required Node 20+, so `nuxt`/`wrangler`/`drizzle-kit` may crash with `SyntaxError: Unexpected identifier` on `import`. In that case put v24 on PATH yourself first (`fnm use 24`, matching `justfile:3`). Bun's package scripts shell out to node-shebang binaries that can resolve to the older `/usr/bin/node` otherwise.

## Commands

Prefer the `just` wrapper (auto-pins node v24); the raw `bun` scripts below are the underlying equivalents.

```bash
bun install                 # install deps (needs modern node for postinstall)
bun dev                     # dev server at http://localhost:3000 (D1 bound via wrangler)
bun run build               # production build → dist/ (Cloudflare Pages preset)
bun run typecheck           # vue-tsc
bun run lint                # eslint

bun run db:generate         # drizzle-kit: schema.ts → SQL migration file
bun run db:migrate:local    # apply migrations to LOCAL D1 (.wrangler/state)
bun run db:migrate:remote   # apply migrations to the REMOTE Cloudflare D1
bun run db:seed:local       # load server/db/seed.sql into local D1
bun run deploy              # build + deploy to Pages project course-schedule-2689336
```

CI (`.github/workflows/ci.yml`) runs on every push — note it uses **pnpm** on Node 22 (not bun) and only runs `lint` + `typecheck`; there is no build/deploy in CI.

There are no automated tests. Verification has been done with headless Chrome via Playwright driving a real browser against `bun dev` — e.g. `bunx playwright-core` pointed at `/usr/bin/google-chrome-stable`, logging in through `ctx.request.post('/api/auth/login')` then exercising the UI. Headless screenshots in dev need a long `--virtual-time-budget` (≈20s) on first load because Vite compiles deps on demand.

## Architecture

Full-stack **Nuxt 4** app. The frontend AND the API live in one project; Nitro builds to the `cloudflare-pages` preset so `server/api/**` runs as a Cloudflare Worker and static assets serve from Pages. There is no separate backend.

**Database access pattern:** D1 is reached only through `useDb(event)` (`server/utils/db.ts`), which reads the binding off `event.context.cloudflare.env.DB` and wraps it in Drizzle. In dev, `nitro-cloudflare-dev` injects that binding from `wrangler.toml`. Every API route that mutates data calls `await requireUserSession(event)` first (nuxt-auth-utils); read routes don't.

**Migrations are split-tool:** drizzle-kit only *generates* SQL (`server/db/migrations/`). Applying it is done by **wrangler**, not `drizzle-kit push` — local and remote D1 are separate databases, hence the `:local` / `:remote` script pair. After editing `server/db/schema.ts`: `db:generate` → `db:migrate:local` (and `db:migrate:remote` before/after deploy).

**Auth & permissions:** two kinds of principal.
- **Super admin** — env-var account, *not* in the DB. `server/api/auth/login.post.ts` checks `runtimeConfig.adminUsername`/`adminPassword` (from `NUXT_ADMIN_USERNAME` / `NUXT_ADMIN_PASSWORD`) first; match ⇒ full access to every page and classroom.
- **DB users** (`users` table) — self-apply via `POST /api/auth/apply` (status `pending`), then a super admin approves/grants pages in `/admin`. `status` gates login (`pending`/`rejected`/`disabled` are refused); `pages` (JSON array of page keys) and `classrooms` (JSON array) scope what they can do.

Session cookie is sealed with `NUXT_SESSION_PASSWORD`. Login uses `replaceUserSession` (not `set`) so a re-login never merges the previous account's `pages`/`classrooms`. Locally these env vars come from `.env` (gitignored; see `.env.example`); on Cloudflare they are Pages secrets — a secret change only takes effect on the **next deployment**.

`runtimeConfig` (`nuxt.config.ts`) maps these env vars: `NUXT_ADMIN_USERNAME`/`NUXT_ADMIN_PASSWORD` (super admin), `NUXT_SESSION_PASSWORD` (cookie seal), and `NUXT_GEMINI_API_KEY`/`NUXT_GEMINI_MODEL` (image-import OCR — see below).

**The permission model is page-based and lives in `shared/utils/`** (Nuxt auto-imports `shared/` on both client and server — single source of truth):
- `pages.ts` — `PAGES` registry. Each page has a `key`, `path`, and `access`: `public` (everyone sees it; permission decides whether you can *edit*) or `private` (hidden unless you have the key; permission decides whether you can *see/use* it). Adding a feature page = add one `PAGES` entry, and the nav bar, route guard, `/admin` checkbox grid, and backend `requirePage` all pick it up.
- `classrooms.ts` — `CLASSROOMS` list + `sanitizeClassrooms`. New/anonymous users default to `中壢` only.

Enforcement is layered — **the frontend guard is cosmetic, the backend is authoritative**:
- Backend: every mutating route calls `await requirePage(event, '<key>')` or `requireSuperAdmin(event)` (`server/utils/auth.ts`). `getActor()` re-reads the DB on every request (so disabling/regranting takes effect immediately and the session's cached `pages` is never trusted server-side).
- Frontend: `app/middleware/auth.global.ts` hides routes the session can't access; `useCanEdit(key)` (`app/composables/`) toggles edit affordances in the UI.

**Per-user data ownership (CRM):** `contacts`/`contact_stages` rows belong to a user — `userId = users.id` for normal users, `NULL` for the super admin (each principal sees only their own list). Routes scope queries with `ownerKey(actor)` + `ownedBy(column, key)` (the latter handles `IS NULL` correctly).

### Data model (`server/db/schema.ts`)

Schedule/equipment:
- `courses` — weekly recurring classes (`dayOfWeek` 1–7, `startTime`/`endTime` as `HH:MM`). `kind` (`course`/`activity`) is a label affecting default color and whether role fields show.
- `events` — one-off dated items (`date` `YYYY-MM-DD`; null `startTime` ⇒ all-day).
- `equipment` — items with `totalQty`, grouped by `classroom`.
- `rentals` — borrow records; `returnDate IS NULL` means "still out". Available qty = `totalQty − sum(open rentals)`, computed in `server/utils/inventory.ts` and enforced on borrow.

Accounts & CRM:
- `users` — DB accounts (see Auth above). `passwordHash` is nuxt-auth-utils scrypt.
- `contacts` — CRM leads, owned per-user. `broached` is a fixed boolean; `completedStages` is a JSON array of `contact_stages.id`. `nextFollowUp` is derived from `lastFollowUp` + `followUpFreq` via `computeNextFollowUp` (`server/utils/followup.ts`).
- `contact_stages` — per-user customizable funnel stages (rename/reorder/delete).
- `follow_up_logs` — timeline entries, many per contact.
- `prospects` — the "每日任務" board (spec 0015): places a `contacts` row into a `section` (`develop`/`reserve`/`five`/`network`). Owned per-user like `contacts` (`userId` = `users.id`, `NULL` for super admin). Stores only its own `date`; name and other fields are read through the referenced `contactId`. Same person may appear in multiple sections but not twice in one; deleting a contact cascades to its prospects.
- `settings` — generic single-key/value store. Currently **unused** — kept after the theme switcher was removed (spec 0017) so future site-wide settings can reuse it. No migration is generated for keeping it.

`courses`/`events`/`equipment` carry a `classroom` field (中壢/新竹/台北/台中, default 中壢). The calendar filters by a classroom tab and only shows tabs the user's `classrooms` allow; the equipment page is hard-pinned to 中壢 (`app/pages/equipment.vue`).

### Frontend specifics

- All schedule editing happens **inline on the FullCalendar** in `app/pages/index.vue` (there is intentionally no schedule-admin page — `/admin` is for user management only). With `useCanEdit('calendar')`: click empty date = create, click event = edit, drag = reschedule (`eventDrop` updates the date for events, or shifts `dayOfWeek` by `info.delta.days` for courses).
- FullCalendar must render inside `<ClientOnly>`. Weekday mapping differs: our `dayOfWeek` is 1=Mon…7=Sun, FullCalendar's `daysOfWeek` is 0=Sun…6=Sat (`dayOfWeek % 7`).
- **Colors are stored as names** (`sky`, `rose`, …). Tailwind classes must be written out literally (`COLOR_OPTIONS` in `app/utils/schedule.ts`) — never build class strings dynamically or Tailwind won't emit them. FullCalendar needs real hex, so there's a parallel `COLOR_HEX` map.

### Bulk import & AI image recognition (specs 0011–0013)

The import modal in `app/pages/index.vue` turns a batch of dated classes into `events`. The pipeline is **draft JSON → editable preview → confirm → `POST /api/events/import`** — a human always reviews before anything is written, so OCR mistakes (especially Chinese names) get caught at the preview step. The JSON shape is `eventImportItemSchema` (`title`+`date` required, plus `startTime`/`endTime`/`host`/`sharer`/`summarizer`/`pm`/`location`/`note`); imports are always `kind: course` and the classroom is picked in the modal.

The JSON can be typed by hand or produced from a photo: "上傳課表圖片" sends a client-shrunk (canvas, long edge ≤1600px, JPEG base64) image to `POST /api/events/ai-extract`, which calls **Gemini** (`gemini-2.5-flash`, free tier) via REST — no SDK, for Workers compatibility. That route forces JSON out with a `responseSchema` and **returns the model's JSON string verbatim** into the preview box; it never touches the DB. Needs `NUXT_GEMINI_API_KEY` (missing key ⇒ 500, but manual-paste import still works); the OCR/role-extraction rules live entirely in the prompt inside `ai-extract.post.ts`.

## Conventions

- **Spec-per-change:** non-trivial changes get a committed, numbered design doc under `specs/` (e.g. `0009-fix-frontend-edit-gating.md`) before/with the implementation. Commit messages are Conventional Commits, often in Chinese. Comments and UI copy are in Traditional Chinese — match the surrounding style.

## Deploy notes

- Live project: **course-schedule-2689336** → https://course-schedule-2689336.pages.dev. `wrangler.toml` `name` and the `deploy` script already point at it.
- `wrangler.toml` holds the D1 binding (`binding = "DB"`, `database_name = "course-schedule-db"`) and `database_id` for the remote DB. `pages_build_output_dir = "dist"`, `compatibility_flags = ["nodejs_compat"]`.
- pages.dev subdomains are globally unique; the bare `course-schedule` name was taken by an unrelated account, which is why the project is suffixed.
