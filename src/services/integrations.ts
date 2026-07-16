import pb from '@/lib/pocketbase/client'

export interface Integration {
  id: string
  name: string
  provider: string
  instance_name: string
  apikey: string
  webhook_url: string
  status: string
  owner: string
  created: string
  updated: string
}

export interface ConnectResult {
  status: string
  base64: string | null
  error?: string
}

export const getIntegrations = async (): Promise<Integration[]> =>
  await pb.collection('integrations').getFullList({ sort: '-created' })

export const connectWhatsapp = async (integrationId: string): Promise<ConnectResult> =>
  await pb.send('/backend/v1/whatsapp/connect', {
    method: 'POST',
    body: JSON.stringify({ integrationId }),
    headers: { 'Content-Type': 'application/json' },
  })

export const disconnectWhatsapp = async (integrationId: string): Promise<{ success: boolean }> =>
  await pb.send('/backend/v1/whatsapp/disconnect', {
    method: 'POST',
    body: JSON.stringify({ integrationId }),
    headers: { 'Content-Type': 'application/json' },
  })

export const deleteIntegration = async (id: string): Promise<void> =>
  await pb.collection('integrations').delete(id)

export const sendMessage = async (contactId: string, text: string): Promise<{ success: boolean }> =>
  await pb.send('/backend/v1/whatsapp/send', {
    method: 'POST',
    body: JSON.stringify({ contactId, text }),
    headers: { 'Content-Type': 'application/json' },
  })
