# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Node version gotcha (read first)

The machine's default `node` is **v11**, far too old for Nuxt — `nuxt`/`wrangler`/`drizzle-kit` will crash with `SyntaxError: Unexpected identifier` on `import`. Before running any command, put a modern node on PATH:

```bash
export PATH=/home/tim/.local/share/mise/installs/node/24.11.1/bin:$PATH   # or: fnm use 22
```

Bun itself is fine, but the package scripts shell out to node-shebang binaries that resolve to v11 otherwise. This applies to `bun install` (postinstall runs `nuxt prepare`), `bun dev`, `bun run build`, and every `bunx wrangler …` call.

## Commands

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

There are no automated tests. Verification has been done with headless Chrome via Playwright driving a real browser against `bun dev` — e.g. `bunx playwright-core` pointed at `/usr/bin/google-chrome-stable`, logging in through `ctx.request.post('/api/auth/login')` then exercising the UI. Headless screenshots in dev need a long `--virtual-time-budget` (≈20s) on first load because Vite compiles deps on demand.

## Architecture

Full-stack **Nuxt 4** app. The frontend AND the API live in one project; Nitro builds to the `cloudflare-pages` preset so `server/api/**` runs as a Cloudflare Worker and static assets serve from Pages. There is no separate backend.

**Database access pattern:** D1 is reached only through `useDb(event)` (`server/utils/db.ts`), which reads the binding off `event.context.cloudflare.env.DB` and wraps it in Drizzle. In dev, `nitro-cloudflare-dev` injects that binding from `wrangler.toml`. Every API route that mutates data calls `await requireUserSession(event)` first (nuxt-auth-utils); read routes don't.

**Migrations are split-tool:** drizzle-kit only *generates* SQL (`server/db/migrations/`). Applying it is done by **wrangler**, not `drizzle-kit push` — local and remote D1 are separate databases, hence the `:local` / `:remote` script pair. After editing `server/db/schema.ts`: `db:generate` → `db:migrate:local` (and `db:migrate:remote` before/after deploy).

**Auth:** single admin, no users table. `server/api/auth/login.post.ts` compares against `runtimeConfig` values fed by env vars `NUXT_ADMIN_USERNAME` / `NUXT_ADMIN_PASSWORD`; the session cookie is sealed with `NUXT_SESSION_PASSWORD`. Locally these come from `.env` (gitignored; see `.env.example`). On Cloudflare they are Pages secrets — adding/changing a secret only takes effect on the **next deployment**.

### Data model (4 tables in `server/db/schema.ts`)

- `courses` — weekly recurring classes (`dayOfWeek` 1–7, `startTime`/`endTime` as `HH:MM`).
- `events` — one-off dated items (`date` `YYYY-MM-DD`; null `startTime` ⇒ all-day).
- `equipment` — items with `totalQty`, grouped by `classroom`.
- `rentals` — borrow records; `returnDate IS NULL` means "still out". Available qty = `totalQty − sum(open rentals)`, computed in `server/utils/inventory.ts` and enforced on borrow.

`courses`/`events`/`equipment` carry a `classroom` field (中壢/新竹/台北/台中, default 中壢) — see `CLASSROOMS` in `app/utils/schedule.ts`. The calendar filters by a classroom tab; the equipment page is currently pinned to 中壢 only.

### Frontend specifics

- All schedule editing happens **inline on the FullCalendar** in `app/pages/index.vue` (there is intentionally no admin page). Logged-in admins: click empty date = create, click event = edit, drag = reschedule (`eventDrop` updates the date for events, or shifts `dayOfWeek` by `info.delta.days` for courses). Gated on `loggedIn`.
- FullCalendar must render inside `<ClientOnly>`. Weekday mapping differs: our `dayOfWeek` is 1=Mon…7=Sun, FullCalendar's `daysOfWeek` is 0=Sun…6=Sat (`dayOfWeek % 7`).
- **Colors are stored as names** (`sky`, `rose`, …). Tailwind classes must be written out literally (`COLOR_OPTIONS` in `app/utils/schedule.ts`) — never build class strings dynamically or Tailwind won't emit them. FullCalendar needs real hex, so there's a parallel `COLOR_HEX` map.

## Deploy notes

- Live project: **course-schedule-2689336** → https://course-schedule-2689336.pages.dev. `wrangler.toml` `name` and the `deploy` script already point at it.
- `wrangler.toml` holds the D1 binding (`binding = "DB"`, `database_name = "course-schedule-db"`) and `database_id` for the remote DB. `pages_build_output_dir = "dist"`, `compatibility_flags = ["nodejs_compat"]`.
- pages.dev subdomains are globally unique; the bare `course-schedule` name was taken by an unrelated account, which is why the project is suffixed.
