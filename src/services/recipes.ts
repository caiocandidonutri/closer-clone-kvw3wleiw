import pb from '@/lib/pocketbase/client'
import type { Recipe } from '@/lib/types'

export const listRecipes = async (): Promise<Recipe[]> =>
  (await pb.collection('recipes').getFullList({ sort: '-created' })) as unknown as Recipe[]

export interface CreateRecipeInput {
  title: string
  description?: string
  content_text?: string
  is_active?: boolean
  file?: File | null
}

export const createRecipe = async (input: CreateRecipeInput): Promise<Recipe> => {
  const ownerId = pb.authStore.model?.id
  if (!ownerId) {
    throw new Error('Usuário não autenticado')
  }
  const formData = new FormData()
  formData.append('title', input.title)
  formData.append('owner', ownerId)
  if (input.description) formData.append('description', input.description)
  if (input.content_text) formData.append('content_text', input.content_text)
  formData.append('is_active', input.is_active === false ? 'false' : 'true')
  if (input.file) formData.append('file', input.file)
  const record = await pb.collection('recipes').create(formData)
  return record as unknown as Recipe
}

export const updateRecipe = async (
  id: string,
  patch: Partial<CreateRecipeInput>,
): Promise<Recipe> => {
  const formData = new FormData()
  if (patch.title !== undefined) formData.append('title', patch.title)
  if (patch.description !== undefined) formData.append('description', patch.description)
  if (patch.content_text !== undefined) formData.append('content_text', patch.content_text)
  if (patch.is_active !== undefined)
    formData.append('is_active', patch.is_active ? 'true' : 'false')
  if (patch.file) formData.append('file', patch.file)
  const record = await pb.collection('recipes').update(id, formData)
  return record as unknown as Recipe
}

export const deleteRecipe = async (id: string): Promise<void> => {
  await pb.collection('recipes').delete(id)
}

/** The PocketBase file URL for a recipe's uploaded PDF/file. */
export const recipeFileUrl = (recipe: Recipe): string => {
  if (!recipe.file) return ''
  return pb.files.getURL(recipe as unknown as Record<string, unknown>, recipe.file)
}
