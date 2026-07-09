import { eq } from 'drizzle-orm'
import { recipes } from '../../db/schema'

// 更新食譜（需 gathering-recipe 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering-recipe')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '食譜 id 不正確' })
  }

  const data = await readValidatedBody(event, recipeInputSchema.parse)
  const db = useDb(event)

  const [updated] = await db
    .update(recipes)
    .set({
      name: data.name,
      ingredients: data.ingredients?.trim() || null,
      steps: data.steps?.trim() || null,
      note: data.note?.trim() || null
    })
    .where(eq(recipes.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這道食譜' })
  }
  return updated
})
