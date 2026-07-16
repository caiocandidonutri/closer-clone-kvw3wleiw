import pb from '@/lib/pocketbase/client'

export interface Message {
  id: string
  contact: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  created: string
  updated: string
}

export const getMessages = async (contactId: string): Promise<Message[]> =>
  await pb.collection('messages').getFullList({
    filter: `contact = "${contactId}"`,
    sort: 'timestamp',
  })
