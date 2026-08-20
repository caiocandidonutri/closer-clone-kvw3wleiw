import pb from '@/lib/pocketbase/client'
import { FALLBACK_PLANS, SubscriptionPlan as IPPlan, INFINITEPAY_LINKS } from '@/lib/infinitepay'
import { Patient, SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'

export type { Patient, SubscriptionPlan }
export type CreatePatientInput = Partial<Patient> & { name: string; phone: string }

export interface PublicStats {
  total_patients: number
  active_subscribers: number
  total_messages: number
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const list = await pb.collection('subscription_plans').getFullList({
      sort: 'price_brl',
      filter: 'is_active = true',
      requestKey: null,
    })
    return list.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug as SubscriptionPlanSlug,
      description: r.description || '',
      price_brl: Number(r.price_brl) || 0,
      duration_days: Number(r.duration_days) || 30,
      message_limit: Number(r.message_limit) || 0,
      limit_type: r.limit_type || 'daily',
      has_all_features: !!r.has_all_features,
      benefits: Array.isArray(r.benefits)
        ? r.benefits
        : typeof r.benefits === 'string'
          ? JSON.parse(r.benefits || '[]')
          : [],
      infinitepay_link: r.infinitepay_link || '',
      infinitepay_order_nsu: r.infinitepay_order_nsu || '',
      is_active: r.is_active !== false,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    return FALLBACK_PLANS as SubscriptionPlan[]
  }
}

export const listPlans = getSubscriptionPlans
export const getPublicSubscriptionPlans = getSubscriptionPlans

export async function getPublicStats(): Promise<PublicStats> {
  try {
    const res = await fetch('/backend/v1/public/stats')
    if (res.ok) {
      const data = await res.json()
      return {
        total_patients: data.total_patients || 0,
        active_subscribers: data.active_subscribers || data.active_patients || 0,
        total_messages: data.total_messages || 0,
      }
    }
  } catch {
    /* intentionally ignored */
  }
  return {
    total_patients: 184,
    active_subscribers: 142,
    total_messages: 24500,
  }
}

export async function listPatients(): Promise<Patient[]> {
  try {
    const records = await pb.collection('patients').getFullList<Patient>({
      sort: '-created',
    })
    return records
  } catch (err) {
    console.error('listPatients error:', err)
    return []
  }
}

export const getPatients = listPatients

export async function getPatient(id: string): Promise<Patient | null> {
  try {
    const record = await pb.collection('patients').getOne<Patient>(id)
    return record
  } catch (err) {
    console.error('getPatient error:', err)
    return null
  }
}

export async function createPatient(data: CreatePatientInput): Promise<Patient> {
  const record = await pb.collection('patients').create<Patient>(data)
  return record
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  const record = await pb.collection('patients').update<Patient>(id, data)
  return record
}

export async function deletePatient(id: string): Promise<boolean> {
  try {
    await pb.collection('patients').delete(id)
    return true
  } catch (err) {
    console.error('deletePatient error:', err)
    return false
  }
}

export async function renewPatient(id: string, planSlug: string): Promise<Patient> {
  const plans = await getSubscriptionPlans()
  const plan = plans.find((p) => p.slug === planSlug)
  const duration = plan?.duration_days || 30
  const messageLimit = plan?.message_limit || 25
  const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()

  return updatePatient(id, {
    subscription_plan: planSlug as any,
    status: 'active',
    subscription_end: expiresAt,
    message_count_limit: messageLimit,
    message_count_used: 0,
  })
}

export async function releasePatientMessages(id: string, bonusAmount = 5): Promise<Patient> {
  const current = await getPatient(id)
  const currentLimit = current?.message_count_limit || 0
  const currentBonus = (current as any)?.message_count_bonus || 0
  return updatePatient(id, {
    message_count_used: 0,
    message_count_limit: currentLimit + bonusAmount,
    message_count_bonus: currentBonus + bonusAmount,
  } as any)
}

export async function registerPatient(data: {
  name: string
  phone: string
  email?: string
  nutritional_goal?: string
  plan_slug?: string
  subscription_plan?: string
}): Promise<{
  success: boolean
  patient_id?: string
  whatsapp_url?: string
  checkout_url?: string
  error?: string
}> {
  return registerPublicPatient(data)
}

export async function registerPublicPatient(data: {
  name: string
  phone: string
  email?: string
  nutritional_goal?: string
  plan_slug?: string
  subscription_plan?: string
}): Promise<{
  success: boolean
  patient_id?: string
  whatsapp_url?: string
  checkout_url?: string
  error?: string
}> {
  try {
    const payload = {
      ...data,
      plan_slug: data.plan_slug || data.subscription_plan || 'free_trial',
      subscription_plan: data.subscription_plan || data.plan_slug || 'free_trial',
    }
    const res = await fetch('/backend/v1/public/register-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      return { success: false, error: json.error || 'Falha no cadastro' }
    }
    return json
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão' }
  }
}
