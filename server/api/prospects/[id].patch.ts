import { and, eq } from 'drizzle-orm'
import { contacts, prospects } from '../../db/schema'

// 更新每日任務關聯列（需 crm 權限）：僅這一列自己的 date 可改。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '資料 id 不正確' })
  }

  const data = await readValidatedBody(event, prospectPatchSchema.parse)
  const db = useDb(event)

  const owner = ownedBy(prospects.userId, ownerKey(actor))
  const [current] = await db.select().from(prospects).where(and(eq(prospects.id, id), owner))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆資料' })
  }

  const [updated] = await db
    .update(prospects)
    .set({ date: data.date || null })
    .where(and(eq(prospects.id, id), owner))
    .returning()

  const row = updated ?? current
  const [c] = await db.select().from(contacts).where(eq(contacts.id, row.contactId))
  return { ...row, contact: c }
})
