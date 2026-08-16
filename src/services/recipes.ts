import { ClientResponseError } from 'pocketbase'
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

/** Friendly message shown to users when the upload fails due to a network problem. */
export const NETWORK_ERROR_MESSAGE =
  'Falha na conexão ao enviar o arquivo. Verifique sua internet e tente novamente.'

/**
 * Returns true when an error is a transient network/timeout failure (as opposed
 * to a validation or auth error), meaning the request is worth retrying.
 *
 * - `ClientResponseError` with `status === 0`  → no response received (DNS/CORS/conn drop)
 * - `ClientResponseError.isAbort === true`     → request aborted/timed out
 * - plain `TypeError` ("Failed to fetch")       → browser-level fetch failure
 */
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof ClientResponseError) {
    return error.status === 0 || error.isAbort
  }
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    return /failed to fetch|networkerror|network request failed|timeout|aborted/i.test(
      error.message,
    )
  }
  return false
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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

  // Large PDFs can be slow to upload and the connection can be dropped by the
  // reverse proxy or the browser before a response arrives. Retry transient
  // network failures with exponential backoff (1s, 2s, 4s). Validation errors
  // (status 4xx) are NOT retried — they will never succeed on a second try.
  const MAX_ATTEMPTS = 3
  const BACKOFF_MS = [1000, 2000, 4000]
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const record = await pb.collection('recipes').create(formData)
      return record as unknown as Recipe
    } catch (error) {
      lastError = error
      // Only retry network/timeout errors; stop immediately on validation/auth errors.
      if (!isNetworkError(error) || attempt === MAX_ATTEMPTS) break
      await sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1])
    }
  }

  // Surface a friendly, localized message instead of the raw "Failed to fetch".
  if (isNetworkError(lastError)) {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
  throw lastError
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
