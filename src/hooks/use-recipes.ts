import { useEffect, useState, useCallback } from 'react'
import type { Recipe } from '@/lib/types'
import {
  listRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  CreateRecipeInput,
} from '@/services/recipes'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const useRecipes = () => {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = useCallback(async () => {
    if (!user) {
      setRecipes([])
      setLoading(false)
      return
    }
    try {
      const data = await listRecipes()
      setRecipes(data)
    } catch (err) {
      console.error('[useRecipes] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  const create = async (input: CreateRecipeInput) => {
    try {
      const r = await createRecipe(input)
      setRecipes((prev) => [r, ...prev])
      return r
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao adicionar receita')
      throw err
    }
  }

  const update = async (id: string, patch: Partial<CreateRecipeInput>) => {
    try {
      const r = await updateRecipe(id, patch)
      setRecipes((prev) => prev.map((x) => (x.id === id ? r : x)))
      toast.success('Receita atualizada')
      return r
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao atualizar receita')
      throw err
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteRecipe(id)
      setRecipes((prev) => prev.filter((x) => x.id !== id))
      toast.success('Receita removida')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover receita')
    }
  }

  return { recipes, loading, create, update, remove, refetch: fetchRecipes }
}
