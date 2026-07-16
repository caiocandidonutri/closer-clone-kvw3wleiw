import { useEffect, useState, useCallback } from 'react'
import { getMessages, Message } from '@/services/messages'
import { useRealtime } from '@/hooks/use-realtime'

export const useMessages = (contactId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!contactId) {
      setLoading(false)
      return
    }
    try {
      const data = await getMessages(contactId)
      setMessages(data)
    } catch (err) {
      console.error('[useMessages] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useRealtime('messages', () => {
    load()
  })

  return { messages, loading }
}
