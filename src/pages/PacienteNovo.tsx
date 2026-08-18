import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlans, usePatients } from '@/hooks/use-patients'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowLeft, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { SubscriptionPlanSlug } from '@/lib/types'

const PLAN_LABELS: Record<SubscriptionPlanSlug, string> = {
  free_trial: 'Free Trial · 3 dias · 20 msgs',
  weekly: 'Semanal · R$29,90 · 7 dias',
  monthly: 'Mensal · R$79,90 · 30 dias',
  quarterly: 'Trimestral · R$199,90 · 90 dias',
}

interface FormState {
  name: string
  phone: string
  email: string
  birth_date: string
  nutritional_goal: string
  subscription_plan: SubscriptionPlanSlug
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  birth_date: '',
  nutritional_goal: '',
  subscription_plan: 'free_trial',
}

export default function PacienteNovo() {
  const navigate = useNavigate()
  const { create } = usePatients()
  const { plans } = usePlans()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nome e telefone são obrigatórios')
      return
    }
    setSaving(true)
    try {
      await create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        birth_date: form.birth_date || undefined,
        nutritional_goal: form.nutritional_goal.trim() || undefined,
        subscription_plan: form.subscription_plan,
      })
      navigate('/app/pacientes')
    } catch (_) {
      // handled in hook
    } finally {
      setSaving(false)
    }
  }

  const previewText = form.name
    ? `Olá ${form.name}! O Dr. Caio Cândido te convidou para o Nutri Responde. Clique aqui para começar: [link]`
    : 'Olá [nome]! O Dr. Caio Cândido te convidou para o Nutri Responde. Clique aqui para começar: [link]'

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
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
              <UserPlus className="h-6 w-6" />
            </span>
            Novo paciente
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Ao cadastrar, um convite é enviado automaticamente pelo WhatsApp.
          </p>
        </div>
      </div>

      <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-xl tracking-tight">Dados do paciente</CardTitle>
            <CardDescription>Preencha as informações abaixo.</CardDescription>
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
                  Convite automático pelo WhatsApp
                </span>
              </div>
              <p className="text-sm text-green-900 whitespace-pre-line font-medium">
                {previewText}
              </p>
            </div>
          </CardContent>

          <div className="flex items-center justify-end gap-3 p-6 md:p-8 pt-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/app/pacientes')}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="rounded-full px-8 shadow-subtle">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar e enviar convite
            </Button>
          </div>
        </form>
      </Card>

      {plans.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {plans.length} planos disponíveis · Veja em{' '}
          <button
            onClick={() => navigate('/app/planos')}
            className="font-bold text-primary hover:underline"
          >
            Planos
          </button>
        </p>
      )}
    </div>
  )
}
