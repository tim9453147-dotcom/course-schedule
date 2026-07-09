import { recipes } from '../../db/schema'

// 新增食譜（需 gathering-recipe 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering-recipe')

  const data = await readValidatedBody(event, recipeInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(recipes)
    .values({
      name: data.name,
      ingredients: data.ingredients?.trim() || null,
      steps: data.steps?.trim() || null,
      note: data.note?.trim() || null
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
