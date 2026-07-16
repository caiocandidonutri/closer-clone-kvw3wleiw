import { useEffect, useState, useCallback } from 'react'
import { AIAgent } from '@/lib/types'
import { toast } from 'sonner'

const STORAGE_KEY = 'closer_ai_agents'

const loadAgents = (): AIAgent[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AIAgent[]) : []
  } catch {
    return []
  }
}

const persist = (agents: AIAgent[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
  } catch {
    /* ignore quota errors */
  }
}

export const useAgents = () => {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setAgents(loadAgents())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const createAgent = async (agent: Partial<AIAgent>) => {
    const newAgent: AIAgent = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      user_id: '',
      name: agent.name!,
      description: agent.description ?? null,
      system_prompt: agent.system_prompt!,
      gemini_api_key: agent.gemini_api_key!,
      is_active: agent.is_active ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const next = [newAgent, ...agents]
    setAgents(next)
    persist(next)
    toast.success('Agent created successfully')
    return newAgent
  }

  const updateAgent = async (id: string, agent: Partial<AIAgent>) => {
    const next = agents.map((a) =>
      a.id === id ? { ...a, ...agent, updated_at: new Date().toISOString() } : a,
    )
    setAgents(next)
    persist(next)
    toast.success('Agent updated successfully')
    return next.find((a) => a.id === id)
  }

  const deleteAgent = async (id: string) => {
    const next = agents.filter((a) => a.id !== id)
    setAgents(next)
    persist(next)
    toast.success('Agent deleted successfully')
  }

  const toggleAgentStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const next = agents.map((a) => (a.id === id ? { ...a, is_active: newStatus } : a))
    setAgents(next)
    persist(next)
  }

  return {
    agents,
    loading,
    refetch: fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
  }
}
