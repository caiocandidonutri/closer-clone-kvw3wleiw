export interface UserIntegration {
  id: string
  user_id: string
  evolution_api_url: string | null
  evolution_api_key: string | null
  instance_name: string | null
  status: 'DISCONNECTED' | 'WAITING_QR' | 'CONNECTED'
  is_setup_completed?: boolean
  is_webhook_enabled?: boolean
  created_at: string
}

export interface AIAgent {
  id: string
  user_id: string
  name: string
  description: string | null
  system_prompt: string
  openai_api_key: string
  gemini_api_key: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppContact {
  id: string
  user_id: string
  remote_jid: string
  phone_number: string | null
  push_name: string | null
  profile_picture_url: string | null
  last_message_at: string | null
  classification: string | null
  score: number | null
  last_message_from_me?: boolean | null
  ai_analysis_summary: string | null
  ai_agent_id: string | null
  pipeline_stage?: string | null
  created_at: string
}

export interface WhatsAppMessage {
  id: string
  user_id: string
  contact_id: string
  message_id: string
  from_me: boolean
  text: string | null
  type: string | null
  timestamp: string
  raw: any
}

export interface YasaAgentConfig {
  id: string
  owner: string
  agent_name: string
  nutritionist_name: string
  specialty: string
  welcome_message: string
  tone: 'leve' | 'formal'
  detail_level: 'curto' | 'detalhado'
  preferred_topics: string[]
  general_guidelines: string
  is_active: boolean
  openai_api_key: string
  gemini_model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'
  temperature: number
  max_response_seconds: number
  gemini_api_key?: string
  created: string
  updated: string
}

export interface AgentMaterial {
  id: string
  owner: string
  title: string
  description: string
  topic: string
  file: string
  image_url?: string
  content_text: string
  is_active: boolean
  created: string
  updated: string
}

export interface MealPlanTemplate {
  id: string
  owner: string
  title: string
  description: string
  topic: string
  file: string
  content_text: string
  is_active: boolean
  created: string
  updated: string
}

export interface Recipe {
  id: string
  owner: string
  title: string
  description: string
  file: string
  content_text: string
  is_active: boolean
  created: string
  updated: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string
  price_brl: number
  duration_days: number
  message_limit: number
  /** "total" = limite acumulado (free_trial/weekly); "daily" = reseta a cada 24h (monthly/quarterly) */
  limit_type: 'total' | 'daily'
  /** true para Mensal e Trimestral (lista de compras + modo geladeira) */
  has_all_features: boolean
  is_active: boolean
  benefits: string[]
  created: string
  updated: string
  /** URL do checkout gerada pela InfinitePay (quando o link foi criado via API) */
  infinitepay_link: string
  /** order_nsu enviado para a InfinitePay ao criar o link */
  infinitepay_order_nsu: string
}

export type PatientStatus = 'active' | 'inactive' | 'trial' | 'expired'
export type SubscriptionPlanSlug = 'free_trial' | 'weekly' | 'monthly' | 'quarterly'

export interface Patient {
  id: string
  owner: string
  name: string
  phone: string
  email: string
  birth_date: string
  nutritional_goal: string
  registration_date: string
  status: PatientStatus
  subscription_plan: SubscriptionPlanSlug
  subscription_start: string
  subscription_end: string
  message_count_used: number
  message_count_limit: number
  /** âncora do reset diário para planos com limit_type = "daily" */
  message_reset_date: string
  contact: string
  invited_by: string
  created: string
  updated: string
  /** último transaction_nsu recebido via webhook (anti-duplicação) */
  infinitepay_transaction_nsu: string
}

export interface YasaFeedback {
  id: string
  owner: string
  message: string
  contact: string
  rating: 'useful' | 'not_useful'
  comment: string
  question_text: string
  answer_text: string
  created: string
  updated: string
}

export interface RevenueExpiringPatient {
  id: string
  name: string
  phone: string
  email: string
  plan: string
  subscription_end: string
  days_left: number
  status: string
}

export interface RevenueOverduePatient {
  id: string
  name: string
  phone: string
  email: string
  plan: string
  subscription_end: string
  days_overdue: number
  status: string
}

export interface PlanDistribution {
  free: number
  weekly: number
  monthly: number
  quarterly: number
}

export interface RevenueMetrics {
  mrr: number
  total_revenue: number
  active_plans: number
  expiring_soon: RevenueExpiringPatient[]
  plan_distribution: PlanDistribution
  overdue: RevenueOverduePatient[]
}

export type NotificationType = 'limit_80' | 'expiring_soon' | 'inactivity_48h' | 'general'

export interface AppNotification {
  id: string
  owner: string
  patient_id?: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  metadata?: Record<string, any>
  created: string
  updated: string
}
