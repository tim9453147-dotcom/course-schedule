# 把 fnm 的 Node v22 釘進每條 recipe 的 PATH，
# 這樣 bun 與它 shell out 的 node-shebang 子程序都不會掉回系統的 /usr/bin/node (v18)。
export PATH := env_var('HOME') / ".local/share/fnm/node-versions/v24.17.0/installation/bin:" + env_var('PATH')

# 列出所有指令（直接打 `just` 也會顯示）
default:
    @just --list

# 安裝相依套件（postinstall 會跑 nuxt prepare）
install:
    bun install

# 開發伺服器 http://localhost:1125
dev:
    bun dev

# 正式建置 → dist/
build:
    bun run build

# 型別檢查
typecheck:
    bun run typecheck

# eslint
lint:
    bun run lint

# 由 schema.ts 產生 SQL migration
db-generate:
    bun run db:generate

# 套用 migration 到本機 D1
db-migrate-local:
    bun run db:migrate:local

# 套用 migration 到遠端 D1
db-migrate-remote:
    bun run db:migrate:remote

# 載入範例資料到本機 D1
db-seed-local:
    bun run db:seed:local

# 建置並部署到 Cloudflare Pages
deploy:
    bun run deploy

# 直接呼叫 wrangler，例如：
# just wrangler pages secret put NUXT_ADMIN_USERNAME --project-name course-schedule-2689336
wrangler *args:
    bunx wrangler {{args}}
