import pb from '@/lib/pocketbase/client'
import type { SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'

/**
 * Manual InfinitePay plan links created directly in the InfinitePay dashboard.
 * These do NOT carry a webhook_url, so payments made through them are not
 * notified automatically. They exist only as a FALLBACK — whenever the
 * create-links endpoint has generated a real link with the webhook configured,
 * that value lives in `subscription_plans.infinitepay_link` and takes priority.
 */
export const INFINITEPAY_FALLBACK_LINKS: Partial<Record<SubscriptionPlanSlug, string>> = {
  weekly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/XfCDjEC9ln',
  monthly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/G21rZgmQ0b',
  quarterly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/fGRzAl740t',
}

/**
 * Resolves the checkout URL for a plan: prefers the API-generated
 * `infinitepay_link` (which has the webhook configured), falling back to the
 * manual dashboard link only when the API link is absent.
 */
export const resolveCheckoutUrl = (plan: Pick<SubscriptionPlan, 'slug' | 'infinitepay_link'>) =>
  plan.infinitepay_link || INFINITEPAY_FALLBACK_LINKS[plan.slug] || ''

export interface CreateLinksResult {
  success: boolean
  handle: string
  webhook_url: string
  redirect_url: string
  api_key_configured: boolean
  message: string | null
  results: Array<{
    slug: string
    ok: boolean
    link?: string
    http?: number
    friendly_error?: string
    error?: unknown
  }>
}

/**
 * Calls the backend endpoint that (re)creates the InfinitePay checkout links
 * for the 3 paid plans, persisting them to `subscription_plans.infinitepay_link`.
 * Requires an authenticated PocketBase session.
 */
export const createInfinitePayLinks = async (): Promise<CreateLinksResult> => {
  try {
    return await pb.send<CreateLinksResult>('/backend/v1/infinitepay/create-links', {
      method: 'POST',
    })
  } catch (err: any) {
    // Surface the backend's JSON error body when available.
    const data = err?.response?.data || err?.data
    if (data && typeof data === 'object') {
      throw Object.assign(new Error(data.message || 'Falha ao criar os links'), { data })
    }
    throw err
  }
}
