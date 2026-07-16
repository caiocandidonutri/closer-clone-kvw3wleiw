import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from './use-auth'
import { getIntegrations, Integration } from '@/services/integrations'
import { useRealtime } from '@/hooks/use-realtime'

interface IntegrationContextType {
  integrations: Integration[]
  loading: boolean
  addIntegration: () => Promise<Integration | null>
  refreshIntegrations: () => Promise<void>
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined)

export const useIntegration = () => {
  const context = useContext(IntegrationContext)
  if (!context) throw new Error('useIntegration must be used within an IntegrationProvider')
  return context
}

export const IntegrationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIntegrations = useCallback(async () => {
    if (!user) {
      setIntegrations([])
      setLoading(false)
      return
    }
    try {
      const data = await getIntegrations()
      setIntegrations(data)
    } catch (err) {
      console.error('[useIntegration] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  useRealtime('integrations', () => {
    fetchIntegrations()
  })

  const addIntegration = async () => {
    if (!user) return null
    const rec = await pb.collection('integrations').create({
      name: 'WhatsApp',
      provider: 'evolution_api',
      status: 'DISCONNECTED',
      owner: user.id,
    })
    return rec as unknown as Integration
  }

  return React.createElement(
    IntegrationContext.Provider,
    {
      value: {
        integrations,
        loading,
        addIntegration,
        refreshIntegrations: fetchIntegrations,
      },
    },
    children,
  )
}
