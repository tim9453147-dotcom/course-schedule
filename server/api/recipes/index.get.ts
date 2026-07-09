import { asc } from 'drizzle-orm'
import { recipes } from '../../db/schema'

// 食譜列表（需 gathering-recipe 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering-recipe')

  const db = useDb(event)
  return await db.select().from(recipes).orderBy(asc(recipes.name))
})
