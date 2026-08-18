import pb from '@/lib/pocketbase/client'
import type { Patient, SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'

// ── Subscription plans ──

export const listPlans = async (): Promise<SubscriptionPlan[]> =>
  (await pb
    .collection('subscription_plans')
    .getFullList({ sort: 'price_brl' })) as unknown as SubscriptionPlan[]

export const getPlan = async (id: string): Promise<SubscriptionPlan> =>
  (await pb.collection('subscription_plans').getOne(id)) as unknown as SubscriptionPlan

// ── Patients ──

export interface CreatePatientInput {
  name: string
  phone: string
  email?: string
  birth_date?: string
  nutritional_goal?: string
  subscription_plan: SubscriptionPlanSlug
  status?: Patient['status']
  contact?: string
}

const PLAN_DURATIONS: Record<SubscriptionPlanSlug, number> = {
  free_trial: 3,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
}

// Limite de mensagens conforme o plano.
// - free_trial / weekly: limite TOTAL (não reseta)
// - monthly / quarterly: limite DIÁRIO (reseta a cada 24h)
const PLAN_MESSAGE_LIMITS: Record<SubscriptionPlanSlug, number> = {
  free_trial: 5,
  weekly: 15,
  monthly: 25,
  quarterly: 40,
}

const PLAN_IS_DAILY: Record<SubscriptionPlanSlug, boolean> = {
  free_trial: false,
  weekly: false,
  monthly: true,
  quarterly: true,
}

/** Builds subscription_start, subscription_end, message_count_limit from a plan slug. */
export const buildSubscriptionDates = (plan: SubscriptionPlanSlug) => {
  const days = PLAN_DURATIONS[plan] || 3
  const limit = PLAN_MESSAGE_LIMITS[plan] ?? 0
  const isDaily = PLAN_IS_DAILY[plan] ?? false
  const start = new Date()
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
  return {
    subscription_start: start.toISOString(),
    subscription_end: end.toISOString(),
    message_count_limit: limit,
    message_count_used: 0,
    // planos diários começam com a âncora de reset já definida
    message_reset_date: isDaily ? start.toISOString() : '',
    registration_date: start.toISOString().slice(0, 10),
    status: plan === 'free_trial' ? 'trial' : 'active',
  }
}

export const listPatients = async (): Promise<Patient[]> =>
  (await pb.collection('patients').getFullList({ sort: '-created' })) as unknown as Patient[]

export const getPatient = async (id: string): Promise<Patient> =>
  (await pb.collection('patients').getOne(id)) as unknown as Patient

export const createPatient = async (input: CreatePatientInput): Promise<Patient> => {
  const ownerId = pb.authStore.model?.id
  if (!ownerId) throw new Error('Usuário não autenticado')
  const dates = buildSubscriptionDates(input.subscription_plan)
  const record = await pb.collection('patients').create({
    owner: ownerId,
    name: input.name,
    phone: input.phone,
    email: input.email || '',
    birth_date: input.birth_date || '',
    nutritional_goal: input.nutritional_goal || '',
    subscription_plan: input.subscription_plan,
    ...dates,
    contact: input.contact || '',
    invited_by: ownerId,
  })
  return record as unknown as Patient
}

export const updatePatient = async (id: string, patch: Partial<Patient>): Promise<Patient> => {
  const record = await pb.collection('patients').update(id, patch)
  return record as unknown as Patient
}

export const deletePatient = async (id: string): Promise<void> => {
  await pb.collection('patients').delete(id)
}

/** Resets a patient's message counter and re-arms the subscription dates (e.g. after upgrade). */
export const renewPatient = async (id: string, plan: SubscriptionPlanSlug): Promise<Patient> => {
  const dates = buildSubscriptionDates(plan)
  const record = await pb.collection('patients').update(id, {
    subscription_plan: plan,
    ...dates,
  })
  return record as unknown as Patient
}
