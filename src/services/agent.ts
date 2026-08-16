import pb from '@/lib/pocketbase/client'
import type { MealPlanTemplate, YasaFeedback } from '@/lib/types'

// ── Meal plan templates ──

export const listTemplates = async (): Promise<MealPlanTemplate[]> =>
  (await pb
    .collection('meal_plan_templates')
    .getFullList({ sort: '-created' })) as unknown as MealPlanTemplate[]

export interface CreateTemplateInput {
  title: string
  description?: string
  topic?: string
  content_text?: string
  is_active?: boolean
  file?: File | null
}

export const createTemplate = async (input: CreateTemplateInput): Promise<MealPlanTemplate> => {
  const formData = new FormData()
  formData.append('title', input.title)
  if (input.description) formData.append('description', input.description)
  if (input.topic) formData.append('topic', input.topic)
  if (input.content_text) formData.append('content_text', input.content_text)
  formData.append('is_active', input.is_active === false ? 'false' : 'true')
  if (input.file) formData.append('file', input.file)
  const record = await pb.collection('meal_plan_templates').create(formData)
  return record as unknown as MealPlanTemplate
}

export const updateTemplate = async (
  id: string,
  patch: Partial<CreateTemplateInput>,
): Promise<MealPlanTemplate> => {
  const formData = new FormData()
  if (patch.title !== undefined) formData.append('title', patch.title)
  if (patch.description !== undefined) formData.append('description', patch.description)
  if (patch.topic !== undefined) formData.append('topic', patch.topic)
  if (patch.content_text !== undefined) formData.append('content_text', patch.content_text)
  if (patch.is_active !== undefined)
    formData.append('is_active', patch.is_active ? 'true' : 'false')
  if (patch.file) formData.append('file', patch.file)
  const record = await pb.collection('meal_plan_templates').update(id, formData)
  return record as unknown as MealPlanTemplate
}

export const deleteTemplate = async (id: string): Promise<void> => {
  await pb.collection('meal_plan_templates').delete(id)
}

export const templateFileUrl = (template: MealPlanTemplate): string => {
  if (!template.file) return ''
  return pb.files.getURL(template as unknown as Record<string, unknown>, template.file)
}

// ── Feedback ──

export interface CreateFeedbackInput {
  message: string
  contact?: string
  rating: 'useful' | 'not_useful'
  comment?: string
  question_text?: string
  answer_text?: string
}

export const createFeedback = async (input: CreateFeedbackInput): Promise<YasaFeedback> => {
  const record = await pb.collection('yasa_feedback').create(input)
  return record as unknown as YasaFeedback
}

// ── Agent chat (Gemini via backend hook) ──

export interface YasaChatInput {
  message: string
  contact_id?: string
  image_base64?: string
  image_mime?: string
}

export interface YasaChatResult {
  content: string
  message_id: string
  needs_human: boolean
  model: string
}

export const yasaChat = async (input: YasaChatInput): Promise<YasaChatResult> =>
  await pb.send('/backend/v1/yasa/chat', {
    method: 'POST',
    body: input,
  })

/** Read a File as a base64 data URL. */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
