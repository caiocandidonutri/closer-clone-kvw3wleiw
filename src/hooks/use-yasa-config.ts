import { useEffect, useState, useCallback } from 'react'
import type { YasaAgentConfig } from '@/lib/types'
import { getYasaConfig, updateYasaConfig } from '@/services/yasa'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const useYasaConfig = () => {
  const { user } = useAuth()
  const [config, setConfig] = useState<YasaAgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    if (!user) {
      setConfig(null)
      setLoading(false)
      return
    }
    try {
      const data = await getYasaConfig()
      setConfig(data)
    } catch (err) {
      console.error('[useYasaConfig] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const save = async (patch: Partial<YasaAgentConfig>) => {
    if (!config) return
    setSaving(true)
    try {
      const updated = await updateYasaConfig(config.id, patch)
      setConfig(updated)
      toast.success('Configuração do agente salva com sucesso')
      return updated
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  return { config, loading, saving, save, refetch: fetchConfig }
}
