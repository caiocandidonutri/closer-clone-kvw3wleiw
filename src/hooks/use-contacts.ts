import { useEffect, useState } from 'react'
import { getContacts, Contact } from '@/services/contacts'
import { useRealtime } from '@/hooks/use-realtime'

export const useContacts = (searchQuery: string = '') => {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await getContacts()
      setContacts(data)
    } catch (err) {
      console.error('[useContacts] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useRealtime('contacts', () => {
    load()
  })

  const filtered = searchQuery
    ? contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.whatsapp_id?.includes(searchQuery),
      )
    : contacts

  return { contacts: filtered, loading }
}
