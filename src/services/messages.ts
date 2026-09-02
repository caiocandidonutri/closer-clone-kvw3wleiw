import pb from '@/lib/pocketbase/client'

export interface Message {
  id: string
  contact: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  feedback: 'useful' | 'not_useful' | null
  needs_human: boolean
  ai_response_seconds: number | null
  flagged?: boolean
  created: string
  updated: string
}

export const getMessages = async (contactId: string): Promise<Message[]> =>
  await pb.collection('messages').getFullList({
    filter: `contact = "${contactId}"`,
    sort: 'timestamp',
  })

export const toggleMessageFlag = async (messageId: string, flagged: boolean): Promise<void> => {
  await pb.collection('messages').update(messageId, { flagged })
}

export const setMessageFeedback = async (
  messageId: string,
  rating: 'useful' | 'not_useful',
): Promise<void> => {
  await pb.collection('messages').update(messageId, { feedback: rating })
}

export const uploadMealPlanPhoto = async (contactId: string, file: File): Promise<void> => {
  const formData = new FormData()
  formData.append('meal_plan_photo', file)
  await pb.collection('contacts').update(contactId, formData)
}
