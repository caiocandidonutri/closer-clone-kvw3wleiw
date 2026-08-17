import pb from '@/lib/pocketbase/client'

export interface Contact {
  id: string
  name: string
  whatsapp_id: string
  status: 'pending' | 'responded'
  avatar_url: string
  last_message: string
  last_message_at: string | null
  wait_time_seconds: number
  metadata: Record<string, unknown> | null
  meal_plan_photo: string
  meal_plan_summary: string
  owner: string
  created: string
  updated: string
  // WhatsApp sync fields (present when synced via Evolution API)
  remote_jid?: string
  phone_number?: string | null
  push_name?: string | null
  profile_picture_url?: string | null
  classification?: string | null
  score?: number | null
  last_message_from_me?: boolean | null
  pipeline_stage?: string | null
}

export const getContacts = async (): Promise<Contact[]> =>
  await pb.collection('contacts').getFullList({ sort: '-created' })

/** Contatos ordenados pela última mensagem (mais recente primeiro) — para o espelho do WhatsApp Web. */
export const getConversations = async (): Promise<Contact[]> =>
  await pb.collection('contacts').getFullList({ sort: '-last_message_at,-updated,-created' })

export const getContact = async (id: string): Promise<Contact> =>
  await pb.collection('contacts').getOne(id)

export const updateContact = async (id: string, data: Partial<Contact>): Promise<Contact> =>
  await pb.collection('contacts').update(id, data)
