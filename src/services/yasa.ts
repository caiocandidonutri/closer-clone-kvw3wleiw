import pb from '@/lib/pocketbase/client'
import type { YasaAgentConfig, AgentMaterial } from '@/lib/types'

const DEFAULT_CONFIG: Partial<YasaAgentConfig> = {
  agent_name: 'Yasa (Assistente Nutrição Dr. Caio)',
  nutritionist_name: 'Dr. Caio Cândido',
  specialty: 'Nutrição clínica e alimentação saudável',
  welcome_message:
    'Olá! Eu sou a Yasa, assistente nutricional do Dr. Caio Cândido. Estou aqui para tirar suas dúvidas sobre alimentação, refeições, lanches e o seu plano alimentar. Como posso ajudar você hoje?',
  tone: 'leve',
  detail_level: 'detalhado',
  preferred_topics: [
    'emagrecimento',
    'ganho de massa',
    'nutrição esportiva',
    'alimentação saudável',
  ],
  general_guidelines:
    'Atendimento sempre acolhedor, objetivo e seguro. Nunca substituir a consulta. Encaminhar ao Dr. Caio qualquer caso clínico, sintoma ou situação de risco. Usar os materiais (PDFs) como base sempre que o assunto tiver relação.',
  is_active: true,
  gemini_api_key: '',
  gemini_model: 'gemini-1.5-flash',
  temperature: 0.7,
  max_response_seconds: 30,
}

/** Fetch the authenticated user's Yasa agent config (the single row), creating it on first access. */
export const getYasaConfig = async (): Promise<YasaAgentConfig> => {
  let record
  try {
    record = await pb.collection('ai_agent_configs').getFirstListItem('')
  } catch {
    // none yet — create with defaults
    record = await pb.collection('ai_agent_configs').create(DEFAULT_CONFIG)
  }
  return record as unknown as YasaAgentConfig
}

export const updateYasaConfig = async (
  id: string,
  patch: Partial<YasaAgentConfig>,
): Promise<YasaAgentConfig> => {
  const record = await pb.collection('ai_agent_configs').update(id, patch)
  return record as unknown as YasaAgentConfig
}

// ── Materials ──

export const listMaterials = async (): Promise<AgentMaterial[]> =>
  (await pb
    .collection('agent_materials')
    .getFullList({ sort: '-created' })) as unknown as AgentMaterial[]

export interface CreateMaterialInput {
  title: string
  description?: string
  topic?: string
  content_text?: string
  is_active?: boolean
  file?: File | null
}

export const createMaterial = async (input: CreateMaterialInput): Promise<AgentMaterial> => {
  const formData = new FormData()
  formData.append('title', input.title)
  if (input.description) formData.append('description', input.description)
  if (input.topic) formData.append('topic', input.topic)
  if (input.content_text) formData.append('content_text', input.content_text)
  formData.append('is_active', input.is_active === false ? 'false' : 'true')
  if (input.file) formData.append('file', input.file)
  const record = await pb.collection('agent_materials').create(formData)
  return record as unknown as AgentMaterial
}

export const updateMaterial = async (
  id: string,
  patch: Partial<CreateMaterialInput>,
): Promise<AgentMaterial> => {
  const formData = new FormData()
  if (patch.title !== undefined) formData.append('title', patch.title)
  if (patch.description !== undefined) formData.append('description', patch.description)
  if (patch.topic !== undefined) formData.append('topic', patch.topic)
  if (patch.content_text !== undefined) formData.append('content_text', patch.content_text)
  if (patch.is_active !== undefined)
    formData.append('is_active', patch.is_active ? 'true' : 'false')
  if (patch.file) formData.append('file', patch.file)
  const record = await pb.collection('agent_materials').update(id, formData)
  return record as unknown as AgentMaterial
}

export const deleteMaterial = async (id: string): Promise<void> => {
  await pb.collection('agent_materials').delete(id)
}

/** The PocketBase file URL for a material's uploaded PDF. */
export const materialFileUrl = (material: AgentMaterial): string => {
  if (!material.file) return ''
  return pb.files.getURL(material as unknown as Record<string, unknown>, material.file)
}
