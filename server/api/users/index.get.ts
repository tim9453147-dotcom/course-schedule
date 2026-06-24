import { desc } from 'drizzle-orm'
import { users } from '../../db/schema'

// 列出所有使用者（超級管理員專用）。不回傳密碼雜湊。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const db = useDb(event)
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      pages: users.pages,
      classrooms: users.classrooms,
      note: users.note,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  // pages / classrooms 轉成陣列方便前端使用
  return rows.map(r => ({ ...r, pages: parsePages(r.pages), classrooms: parseClassrooms(r.classrooms) }))
})
