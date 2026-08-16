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
