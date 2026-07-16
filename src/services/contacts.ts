import pb from '@/lib/pocketbase/client'

export interface Contact {
  id: string
  name: string
  whatsapp_id: string
  status: 'pending' | 'responded'
  avatar_url: string
  last_message: string
  wait_time_seconds: number
  metadata: Record<string, unknown> | null
  owner: string
  created: string
  updated: string
}

export const getContacts = async (): Promise<Contact[]> =>
  await pb.collection('contacts').getFullList({ sort: '-created' })

export const getContact = async (id: string): Promise<Contact> =>
  await pb.collection('contacts').getOne(id)

export const updateContact = async (id: string, data: Partial<Contact>): Promise<Contact> =>
  await pb.collection('contacts').update(id, data)
