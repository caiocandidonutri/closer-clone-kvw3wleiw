import pb from '@/lib/pocketbase/client'
import type { AppNotification } from '@/lib/types'

export interface GetNotificationsResponse {
  items: AppNotification[]
  total: number
  unread_count: number
}

export async function getNotifications(): Promise<GetNotificationsResponse> {
  try {
    const records = await pb.collection('notifications').getList(1, 100, {
      sort: '-created',
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
  try {
    await pb.send(`/backend/v1/notifications/${id}/read`, {
      method: 'POST',
    })
    return true
  } catch (err) {
    console.warn('[notificationsService] markRead hook error, trying direct update:', err)
    try {
      await pb.collection('notifications').update(id, { read: true })
      return true
    } catch (updateErr) {
      console.error('[notificationsService] direct update error:', updateErr)
      return false
    }
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    await pb.send('/backend/v1/notifications/read-all', {
      method: 'POST',
    })
    return true
  } catch (err) {
    console.warn('[notificationsService] markAllRead hook error:', err)
    return false
  }
}

export async function triggerNotificationCheck(): Promise<{
  success: boolean
  created_count?: number
}> {
  try {
    const res = await pb.send<{ success: boolean; created_count: number }>(
      '/backend/v1/notifications/trigger-check',
      {
        method: 'POST',
      },
    )
    return res
  } catch (err) {
    console.error('[notificationsService] triggerCheck error:', err)
    return { success: false }
  }
}
