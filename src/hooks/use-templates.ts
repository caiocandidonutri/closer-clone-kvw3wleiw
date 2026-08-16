import { useEffect, useState, useCallback } from 'react'
import type { MealPlanTemplate } from '@/lib/types'
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  CreateTemplateInput,
} from '@/services/agent'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const useTemplates = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([])
      setLoading(false)
      return
    }
    try {
      const data = await listTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('[useTemplates] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const create = async (input: CreateTemplateInput) => {
    try {
      const t = await createTemplate(input)
      setTemplates((prev) => [t, ...prev])
      toast.success('Modelo de plano adicionado com sucesso')
      return t
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao adicionar modelo')
    }
  }

  const update = async (id: string, patch: Partial<CreateTemplateInput>) => {
    try {
      const t = await updateTemplate(id, patch)
      setTemplates((prev) => prev.map((x) => (x.id === id ? t : x)))
      toast.success('Modelo atualizado')
      return t
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao atualizar modelo')
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteTemplate(id)
      setTemplates((prev) => prev.filter((x) => x.id !== id))
      toast.success('Modelo removido')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover modelo')
    }
  }

  const toggle = async (id: string, current: boolean) => {
    return update(id, { is_active: !current })
  }

  return { templates, loading, create, update, remove, toggle, refetch: fetchTemplates }
}
