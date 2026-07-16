import pb from '@/lib/pocketbase/client'

export interface YasaChatResult {
  content: string
  conversation_id: string
  message_id: string
}

export const chatWithYasa = async (
  message: string,
  conversationId?: string,
): Promise<YasaChatResult> =>
  await pb.send('/backend/v1/yasa/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId || null }),
    headers: { 'Content-Type': 'application/json' },
  })
