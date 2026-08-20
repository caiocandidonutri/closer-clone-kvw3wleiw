import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePatients, usePlans } from '@/hooks/use-patients'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ArrowLeft,
  UserCheck,
  Check,
  Unlock,
  Save,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SubscriptionPlanSlug, PatientStatus } from '@/lib/types'

const PLAN_LABELS: Record<SubscriptionPlanSlug, string> = {
  free_trial: 'Grátis · 3 msgs (total)',
  weekly: 'Semanal · R$29,90 · 7 dias · 15 msgs',
  monthly: 'Mensal · R$79,90 · 30 dias · 25 msgs/dia',
  quarterly: 'Trimestral · R$199,90 · 90 dias · 40 msgs/dia',
}

const STATUS_OPTIONS: { value: PatientStatus; label: string }[] = [
  { value: 'active', label: 'Ativo' },
  { value: 'trial', label: 'Em Trial' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'expired', label: 'Expirado' },
  { value: 'cancelled', label: 'Cancelado' },
]

interface FormState {
  name: string
  phone: string
  email: string
  birth_date: string
  nutritional_goal: string
  subscription_plan: SubscriptionPlanSlug
  status: PatientStatus
  message_count_used: number
  message_count_limit: number
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  birth_date: '',
  nutritional_goal: '',
  subscription_plan: 'free_trial',
  status: 'trial',
  message_count_used: 0,
  message_count_limit: 3,
}

export default function PacienteEditar() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getById, update, releaseMessages } = usePatients()
  const { plans } = usePlans()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const patient = await getById(id)
        if (!patient && mounted) {
          toast.error('Paciente não encontrado')
          navigate('/app/pacientes')
          return
        }
        if (patient && mounted) {
          setForm({
            name: patient.name || '',
            phone: patient.phone || '',
            email: patient.email || '',
            birth_date: patient.birth_date ? patient.birth_date.split('T')[0] : '',
            nutritional_goal: patient.nutritional_goal || '',
            subscription_plan: (patient.subscription_plan as SubscriptionPlanSlug) || 'free_trial',
            status: (patient.status as PatientStatus) || 'trial',
            message_count_used: patient.message_count_used || 0,
            message_count_limit: patient.message_count_limit ?? 3,
          })
        }
      } catch (err: any) {
        if (mounted) {
          toast.error(err?.message || 'Erro ao carregar dados do paciente')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [id, getById, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nome e telefone são obrigatórios')
      return
    }

    setSaving(true)
    try {
      await update(id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        birth_date: form.birth_date || undefined,
        nutritional_goal: form.nutritional_goal.trim() || undefined,
        subscription_plan: form.subscription_plan,
        status: form.status,
        message_count_limit: Number(form.message_count_limit) || 0,
      })
      navigate('/app/pacientes')
    } catch (_) {
      // toast is already handled in hook
    } finally {
      setSaving(false)
    }
  }

  const handleReleaseBonus = async () => {
    if (!id) return
    setReleasing(true)
    try {
      const updated = await releaseMessages(id, 5)
      if (updated) {
        setForm((prev) => ({
          ...prev,
          message_count_used: updated.message_count_used || 0,
          message_count_limit: updated.message_count_limit || prev.message_count_limit + 5,
        }))
      }
    } catch (_) {
      // toast in hook
    } finally {
      setReleasing(false)
    }
  }

  const previewText = form.name
    ? `Olá ${form.name}! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri Responde! Sua assistente Yasa já está pronta para te ajudar. Que tal começar me contando qual é o seu principal objetivo? 💚`
    : 'Olá [nome]! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri Responde! Sua assistente Yasa já está pronta para te ajudar. Que tal começar me contando qual é o seu principal objetivo? 💚'

  const hasReachedLimit =
    form.message_count_limit > 0 && form.message_count_used >= form.message_count_limit

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Carregando dados do paciente...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate('/app/pacientes')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <span className="bg-primary/10 text-primary p-2 rounded-xl">
                <UserCheck className="h-6 w-6" />
              </span>
              Editar paciente
            </h2>
            <p className="text-muted-foreground mt-1 font-medium">
              Atualize as informações, limites de mensagens e status da assinatura.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleReleaseBonus}
          disabled={releasing}
          variant="outline"
          className="rounded-full border-primary/30 text-primary hover:bg-primary/10 shrink-0"
        >
          {releasing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Unlock className="mr-2 h-4 w-4" />
          )}
          Liberar +5 mensagens
        </Button>
      </div>

      <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl tracking-tight">Dados do paciente</CardTitle>
                <CardDescription>
                  Modifique os campos necessários e salve as alterações.
                </CardDescription>
              </div>
              {hasReachedLimit && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Limite Atingido
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="p_name" className="font-semibold">
                Nome completo *
              </Label>
              <Input
                id="p_name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl h-12"
                placeholder="Ex.: Maria Silva"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="p_phone" className="font-semibold">
                  Telefone / WhatsApp *
                </Label>
                <Input
                  id="p_phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="rounded-xl h-12"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_email" className="font-semibold">
                  Email
                </Label>
                <Input
                  id="p_email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-xl h-12"
                  placeholder="maria@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="p_birth" className="font-semibold">
                  Data de nascimento
                </Label>
                <Input
                  id="p_birth"
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_status" className="font-semibold">
                  Status
                </Label>
                <select
                  id="p_status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PatientStatus })}
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p_plan" className="font-semibold">
                Plano de assinatura
              </Label>
              <select
                id="p_plan"
                value={form.subscription_plan}
                onChange={(e) =>
                  setForm({ ...form, subscription_plan: e.target.value as SubscriptionPlanSlug })
                }
                className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.keys(PLAN_LABELS) as SubscriptionPlanSlug[]).map((slug) => (
                  <option key={slug} value={slug}>
                    {PLAN_LABELS[slug]}
                  </option>
                ))}
              </select>
            </div>

            {/* Message usage and limit controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Mensagens Utilizadas (somente leitura)</span>
                </div>
                <Input
                  disabled
                  value={`${form.message_count_used} msgs`}
                  className="rounded-xl h-11 bg-muted/60 font-semibold cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Unlock className="h-3.5 w-3.5 text-primary" />
                  <Label htmlFor="p_limit" className="font-semibold text-xs cursor-pointer">
                    Limite de Mensagens (editável)
                  </Label>
                </div>
                <Input
                  id="p_limit"
                  type="number"
                  min="0"
                  value={form.message_count_limit}
                  onChange={(e) =>
                    setForm({ ...form, message_count_limit: parseInt(e.target.value, 10) || 0 })
                  }
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p_goal" className="font-semibold">
                Objetivo nutricional
              </Label>
              <Textarea
                id="p_goal"
                value={form.nutritional_goal}
                onChange={(e) => setForm({ ...form, nutritional_goal: e.target.value })}
                className="rounded-xl min-h-[80px] resize-none"
                placeholder="Ex.: Emagrecimento, ganho de massa, controle de diabetes..."
              />
            </div>

            {/* WhatsApp invite preview */}
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-bold text-green-800">
                  Preview do convite WhatsApp atualizado
                </span>
              </div>
              <p className="text-sm text-green-900 whitespace-pre-line font-medium">
                {previewText}
              </p>
            </div>
          </CardContent>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 md:p-8 pt-0 border-t border-border/40 bg-muted/10">
            <Button
              type="button"
              variant="outline"
              onClick={handleReleaseBonus}
              disabled={releasing}
              className="w-full sm:w-auto rounded-full text-primary border-primary/30 hover:bg-primary/10"
            >
              {releasing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              Liberar +5 mensagens
            </Button>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/app/pacientes')}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full px-8 shadow-subtle">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
