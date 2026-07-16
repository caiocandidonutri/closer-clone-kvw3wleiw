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

const CONNECT_TIMEOUT_MS = 20000

export const getIntegrations = async (): Promise<Integration[]> =>
  await pb.collection('integrations').getFullList({ sort: '-created' })

export const connectWhatsapp = async (integrationId: string): Promise<ConnectResult> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)

  try {
    return await pb.send<ConnectResult>('/backend/v1/whatsapp/connect', {
      method: 'POST',
      body: { integrationId },
      signal: controller.signal,
    } as Parameters<typeof pb.send>[1])
  } catch (err: unknown) {
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      throw new Error(
        'Connection timeout. The server did not respond within 20 seconds. Please try again.',
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export const disconnectWhatsapp = async (integrationId: string): Promise<{ success: boolean }> =>
  await pb.send('/backend/v1/whatsapp/disconnect', {
    method: 'POST',
    body: { integrationId },
  })

export const deleteIntegration = async (id: string): Promise<void> =>
  await pb.collection('integrations').delete(id)

export const sendMessage = async (
  contactId: string,
  text: string,
  integrationId?: string,
): Promise<{ success: boolean }> =>
  await pb.send('/backend/v1/whatsapp/send', {
    method: 'POST',
    body: { contactId, text, integrationId },
  })
