import { useEffect, useState, useCallback } from 'react'
import type { AgentMaterial } from '@/lib/types'
import {
  listMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  CreateMaterialInput,
} from '@/services/yasa'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const useMaterials = () => {
  const { user } = useAuth()
  const [materials, setMaterials] = useState<AgentMaterial[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMaterials = useCallback(async () => {
    if (!user) {
      setMaterials([])
      setLoading(false)
      return
    }
    try {
      const data = await listMaterials()
      setMaterials(data)
    } catch (err) {
      console.error('[useMaterials] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const create = async (input: CreateMaterialInput) => {
    try {
      const m = await createMaterial(input)
      setMaterials((prev) => [m, ...prev])
      toast.success('Material adicionado com sucesso')
      return m
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao adicionar material')
    }
  }

  const update = async (id: string, patch: Partial<CreateMaterialInput>) => {
    try {
      const m = await updateMaterial(id, patch)
      setMaterials((prev) => prev.map((x) => (x.id === id ? m : x)))
      toast.success('Material atualizado')
      return m
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao atualizar material')
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteMaterial(id)
      setMaterials((prev) => prev.filter((x) => x.id !== id))
      toast.success('Material removido')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover material')
    }
  }

  const toggle = async (id: string, current: boolean) => {
    return update(id, { is_active: !current })
  }

  return { materials, loading, create, update, remove, toggle, refetch: fetchMaterials }
}
