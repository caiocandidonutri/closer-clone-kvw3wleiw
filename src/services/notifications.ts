import pb from '@/lib/pocketbase/client'
import type { AppNotification } from '@/lib/types'

export interface GetNotificationsResponse {
  items: AppNotification[]
  total: number
  unread_count: number
}

export async function getNotifications(page = 1, perPage = 50): Promise<GetNotificationsResponse> {
  if (!pb.authStore.isValid) {
    return { items: [], total: 0, unread_count: 0 }
  }

  try {
    const records = await pb.collection('notifications').getList(page, perPage, {
      sort: '-created',
      requestKey: null,
    })
    const items: AppNotification[] = records.items.map((r: any) => ({
      id: r.id,
      owner: r.owner,
      patient_id: r.patient_id,
      type: r.type || 'general',
      title: r.title || '',
      message: r.message || '',
      read: !!r.read,
      metadata: r.metadata,
      created: r.created,
      updated: r.updated,
    }))
    return {
      items,
      total: records.totalItems,
      unread_count: items.filter((i) => !i.read).length,
    }
  } catch (err) {
    console.error('[notificationsService] getNotifications error:', err)
    return { items: [], total: 0, unread_count: 0 }
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  if (!pb.authStore.isValid) return false

  try {
    await pb.send(`/backend/v1/notifications/${id}/read`, {
      method: 'POST',
    })
    return true
  } catch {
    try {
      await pb.collection('notifications').update(id, { read: true })
      return true
    } catch {
      return false
    }
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  if (!pb.authStore.isValid) return false

  try {
    await pb.send('/backend/v1/notifications/read-all', {
      method: 'POST',
    })
    return true
  } catch {
    return false
  }
}

export async function deleteNotification(id: string): Promise<boolean> {
  try {
    await pb.collection('notifications').delete(id)
    return true
  } catch (err) {
    console.error('[notificationsService] deleteNotification error:', err)
    return false
  }
}

export async function deleteAllReadNotifications(): Promise<{
  success: boolean
  deleted_count?: number
}> {
  try {
    const res = await pb.send<{ success: boolean; deleted_count: number }>(
      '/backend/v1/notifications/delete-read',
      {
        method: 'POST',
      },
    )
    return res
  } catch (err) {
    console.warn(
      '[notificationsService] delete-read endpoint failed, fallback to manual list:',
      err,
    )
    try {
      const readRecords = await pb.collection('notifications').getFullList({
        filter: 'read = true',
        requestKey: null,
      })
      let count = 0
      for (const rec of readRecords) {
        try {
          await pb.collection('notifications').delete(rec.id)
          count++
        } catch {
          /* intentionally ignored */
        }
      }
      return { success: true, deleted_count: count }
    } catch (manualErr) {
      console.error('[notificationsService] manual delete error:', manualErr)
      return { success: false, deleted_count: 0 }
    }
  }
}

export async function generateNotificationAiDraft(params: {
  notification_id?: string
  patient_id?: string
  custom_prompt?: string
}): Promise<{
  success: boolean
  draft: string
  patient_name?: string
  patient_phone?: string
}> {
  try {
    const res = await pb.send<{
      success: boolean
      draft: string
      patient_name?: string
      patient_phone?: string
    }>('/backend/v1/notifications/ai-draft', {
      method: 'POST',
      body: params,
    })
    return res
  } catch (err: any) {
    console.error('[notificationsService] generateAiDraft error:', err)
    return {
      success: false,
      draft: '',
    }
  }
}

export async function sendNotificationWhatsapp(params: {
  notification_id?: string
  patient_id?: string
  message: string
}): Promise<{
  success: boolean
  whatsapp_sent: boolean
  error?: string
}> {
  try {
    const res = await pb.send<{
      success: boolean
      whatsapp_sent: boolean
      error?: string
    }>('/backend/v1/notifications/send-whatsapp', {
      method: 'POST',
      body: params,
    })
    return res
  } catch (err: any) {
    console.error('[notificationsService] sendWhatsapp error:', err)
    return {
      success: false,
      whatsapp_sent: false,
      error: err?.message || 'Falha ao enviar mensagem',
    }
  }
}

export async function triggerNotificationCheck(): Promise<{
  success: boolean
  created_count?: number
}> {
  if (!pb.authStore.isValid) {
    return { success: false, created_count: 0 }
  }

  try {
    const res = await pb.send<{ success: boolean; created_count: number }>(
      '/backend/v1/notifications/trigger-check',
      {
        method: 'POST',
      },
    )
    return res
  } catch {
    return { success: false, created_count: 0 }
  }
}
