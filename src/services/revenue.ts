import pb from '@/lib/pocketbase/client'
import type { RevenueMetrics } from '@/lib/types'

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  try {
    const data = await pb.send<RevenueMetrics>('/backend/v1/dashboard/revenue', {
      method: 'GET',
    })
    return data
  } catch (err) {
    console.error('[revenueService] getRevenueMetrics error:', err)
    // Fallback safe object
    return {
      mrr: 0,
      total_revenue: 0,
      active_plans: 0,
      expiring_soon: [],
      plan_distribution: { free: 0, weekly: 0, monthly: 0, quarterly: 0 },
      overdue: [],
    }
  }
}
