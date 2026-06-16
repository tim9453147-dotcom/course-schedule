import { defineConfig } from 'drizzle-kit'

// drizzle-kit 只負責「產生」SQL migration 檔，
// 實際套用到 D1 是用 wrangler（見 package.json 的 db:migrate 指令）。
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.ts',
  out: './server/db/migrations'
})
