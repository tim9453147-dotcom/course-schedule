import { eq } from 'drizzle-orm'
import { recipes, gatherings } from '../../db/schema'

// 刪除食譜（需 gathering-recipe 權限）。先把引用它的活動 recipeId 設回 null。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering-recipe')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '食譜 id 不正確' })
  }

  const db = useDb(event)
  await db.update(gatherings).set({ recipeId: null }).where(eq(gatherings.recipeId, id))
  const [deleted] = await db.delete(recipes).where(eq(recipes.id, id)).returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這道食譜' })
  }
  return { ok: true }
})
