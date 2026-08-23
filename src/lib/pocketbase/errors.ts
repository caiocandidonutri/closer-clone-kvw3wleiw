import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return 'Erro de conexão. Verifique sua internet.'
      }
      return error.message
    }
    return 'Ocorreu um erro inesperado.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) {
    return msgs
      .map((m) => {
        if (m.toLowerCase().includes('failed to authenticate')) {
          return 'E-mail ou senha incorretos.'
        }
        if (m.toLowerCase().includes('already in use') || m.toLowerCase().includes('unique')) {
          return 'Este e-mail já está em uso.'
        }
        if (m.toLowerCase().includes('required')) {
          return 'Este campo é obrigatório.'
        }
        return m
      })
      .join(' ')
  }

  const raw = error.message || ''
  if (raw.toLowerCase().includes('failed to authenticate')) {
    return 'E-mail ou senha incorretos.'
  }
  if (raw.toLowerCase().includes('something went wrong')) {
    return 'Ocorreu um erro inesperado no servidor.'
  }
  if (raw.toLowerCase().includes('file not found') || error.status === 404) {
    return 'Recurso não encontrado.'
  }
  return raw || 'Ocorreu um erro inesperado.'
}
