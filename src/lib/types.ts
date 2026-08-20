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

export type SubscriptionPlanSlug = 'free_trial' | 'weekly' | 'monthly' | 'quarterly'
export type PatientStatus = 'trial' | 'active' | 'expired' | 'cancelled' | 'inactive'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: SubscriptionPlanSlug
  description: string
  price_brl: number
  duration_days: number
  message_limit: number
  limit_type: 'daily' | 'total'
  has_all_features: boolean
  benefits: string[]
  infinitepay_link?: string
  infinitepay_order_nsu?: string
  is_active: boolean
  created: string
  updated: string
}

export interface Patient {
  id: string
  name: string
  phone: string
  email?: string
  notes?: string
  birth_date?: string
  nutritional_goal?: string
  registration_date?: string
  status: PatientStatus
  subscription_plan: SubscriptionPlanSlug
  subscription_status?: string
  subscription_start?: string
  subscription_end?: string
  subscription_started_at?: string
  subscription_expires_at?: string
  message_count_used: number
  message_count_limit: number
  message_reset_date?: string
  auto_messages_enabled?: boolean
  total_messages?: number
  last_interaction?: string
  last_interaction_at?: string
  avatar_url?: string
  contact?: string
  invited_by?: string
  infinitepay_transaction_nsu?: string
  owner: string
  created: string
  updated: string
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

export interface Contact {
  id: string
  name: string
  phone_number: string
  whatsapp_id?: string
  remote_jid?: string
  push_name?: string
  avatar_url?: string
  patient_id?: string
  owner: string
  status: 'pending' | 'responded' | 'blocked'
  pipeline_stage?: string
  last_message?: string
  last_message_at?: string
  last_message_from_me?: boolean
  created: string
  updated: string
}

export interface Message {
  id: string
  contact: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  needs_human?: boolean
  ai_response_seconds?: number
  created: string
  updated: string
}
