import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from './use-auth'

export interface UserIntegration {
  id: string
  user_id: string
  instance_name: string | null
  status: string
  is_setup_completed: boolean
  is_webhook_enabled: boolean
}

interface IntegrationContextType {
  integrations: UserIntegration[]
  loading: boolean
  addIntegration: () => Promise<UserIntegration | null>
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
  const [integrations, setIntegrations] = useState<UserIntegration[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIntegrations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data) setIntegrations(data as UserIntegration[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) {
      setIntegrations([])
      setLoading(false)
      return
    }

    fetchIntegrations()

    const channel = supabase
      .channel('integration_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_integrations',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchIntegrations()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchIntegrations])

  const addIntegration = async () => {
    if (!user) return null
    const newIntegration = {
      user_id: user.id,
      status: 'DISCONNECTED',
      is_setup_completed: false,
      is_webhook_enabled: false,
    }
    const { data: inserted } = await supabase
      .from('user_integrations')
      .insert(newIntegration as any)
      .select()
      .single()

    if (inserted) {
      setIntegrations((prev) => [...prev, inserted as UserIntegration])
      return inserted as UserIntegration
    }
    return null
  }

  return React.createElement(
    IntegrationContext.Provider,
    { value: { integrations, loading, addIntegration, refreshIntegrations: fetchIntegrations } },
    children,
  )
}
