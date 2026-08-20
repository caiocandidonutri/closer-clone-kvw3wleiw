import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Mail,
  Lock,
  User,
  Phone,
  Target,
  Sparkles,
  Check,
  X,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Stethoscope,
  HeartHandshake,
} from 'lucide-react'
import closerLogo from '@/assets/closer_logo-fcd09.png'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { registerPatient, listPlans } from '@/services/patients'
import { resolveCheckoutUrl, INFINITEPAY_FALLBACK_LINKS } from '@/lib/infinitepay'
import type { SubscriptionPlan, SubscriptionPlanSlug } from '@/lib/types'
import { toast } from 'sonner'

const NUTRITIONAL_GOALS = [
  { value: 'Emagrecimento', label: 'Emagrecimento' },
  { value: 'Hipertrofia', label: 'Hipertrofia (Ganho de Massa)' },
  { value: 'Saúde Feminina', label: 'Saúde Feminina' },
  { value: 'Diabetes', label: 'Controle de Diabetes' },
  { value: 'Outro', label: 'Outro objetivo de saúde' },
]

interface PlanDisplay {
  slug: SubscriptionPlanSlug
  name: string
  priceFormatted: string
  priceNum: number
  durationFormatted: string
  durationDays: number
  messageLimitLabel: string
  icon: string
  popular?: boolean
  features: Array<{ text: string; included: boolean }>
  description: string
}

const STATIC_PLANS: PlanDisplay[] = [
  {
    slug: 'free_trial',
    name: 'Grátis',
    priceFormatted: 'R$ 0',
    priceNum: 0,
    durationFormatted: '3 mensagens',
    durationDays: 3,
    messageLimitLabel: '3 mensagens',
    icon: '🆓',
    description: 'Orientação nutricional básica sem cartão.',
    features: [
      { text: 'Orientação nutricional básica', included: true },
      { text: 'Receitas de lanches', included: false },
      { text: 'Estratégia de marmitas', included: false },
      { text: 'Lista de compras inteligente', included: false },
      { text: 'Geladeira inteligente', included: false },
    ],
  },
  {
    slug: 'weekly',
    name: 'Semanal',
    priceFormatted: 'R$ 29,90',
    priceNum: 29.9,
    durationFormatted: '7 dias',
    durationDays: 7,
    messageLimitLabel: '15 mensagens',
    icon: '📅',
    popular: true,
    description: 'Orientação nutricional com receitas de lanches.',
    features: [
      { text: 'Orientação nutricional', included: true },
      { text: 'Receitas de lanches', included: true },
      { text: 'Estratégia de marmitas', included: false },
      { text: 'Lista de compras inteligente', included: false },
      { text: 'Geladeira inteligente', included: false },
    ],
  },
  {
    slug: 'monthly',
    name: 'Mensal',
    priceFormatted: 'R$ 79,90',
    priceNum: 79.9,
    durationFormatted: '30 dias',
    durationDays: 30,
    messageLimitLabel: '25 mensagens/dia',
    icon: '📆',
    description: 'Plano completo com marmitas, receitas e geladeira inteligente.',
    features: [
      { text: 'Orientação nutricional', included: true },
      { text: 'Receitas de lanches', included: true },
      { text: 'Estratégia de marmitas + planos semanais', included: true },
      { text: 'Lista de compras inteligente', included: true },
      { text: 'Geladeira inteligente', included: true },
    ],
  },
  {
    slug: 'quarterly',
    name: 'Trimestral',
    priceFormatted: 'R$ 199,90',
    priceNum: 199.9,
    durationFormatted: '90 dias',
    durationDays: 90,
    messageLimitLabel: '40 mensagens/dia',
    icon: '📊',
    description: 'Tudo do mensal com acompanhamento premium e prioridade.',
    features: [
      { text: 'Tudo do plano Mensal', included: true },
      { text: 'Acompanhamento premium', included: true },
      { text: 'Prioridade no WhatsApp', included: true },
      { text: 'Relatórios semanais', included: true },
    ],
  },
]

export default function Auth() {
  const { user, signIn, signUp, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const defaultRole = searchParams.get('tab') === 'nutri' ? 'nutri' : 'patient'
  const [role, setRole] = useState<'patient' | 'nutri'>(defaultRole)

  // ── Nutricionista login state ──
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nutriError, setNutriError] = useState<string | null>(null)
  const [nutriSubmitting, setNutriSubmitting] = useState(false)

  // ── Paciente Onboarding state ──
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [nutritionalGoal, setNutritionalGoal] = useState('Emagrecimento')
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanSlug>('free_trial')
  const [patientSubmitting, setPatientSubmitting] = useState(false)
  const [patientError, setPatientError] = useState<string | null>(null)
  const [patientSuccess, setPatientSuccess] = useState<boolean>(false)

  // ── Planos dinâmicos da API ──
  const [dbPlans, setDbPlans] = useState<SubscriptionPlan[]>([])

  useEffect(() => {
    listPlans()
      .then((p) => setDbPlans(p))
      .catch(() => {
        // fallback to static
      })
  }, [])

  if (!authLoading && user) {
    return <Navigate to="/app" replace />
  }

  // ── Nutri Submit ──
  const handleNutriSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNutriError(null)
    setNutriSubmitting(true)

    try {
      const result =
        mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

      if (result.error) {
        setNutriError(getErrorMessage(result.error))
        return
      }

      navigate('/app', { replace: true })
    } catch (err) {
      setNutriError(getErrorMessage(err))
    } finally {
      setNutriSubmitting(false)
    }
  }

  // ── Patient Submit ──
  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPatientError(null)

    if (!patientName.trim()) {
      setPatientError('Por favor, informe seu nome completo')
      return
    }
    if (!patientPhone.trim()) {
      setPatientError('Por favor, informe seu número de WhatsApp com DDD')
      return
    }

    setPatientSubmitting(true)

    try {
      if (selectedPlan === 'free_trial') {
        // Free Trial: cria o paciente diretamente no backend e dispara mensagem de boas-vindas
        const res = await registerPatient({
          name: patientName.trim(),
          phone: patientPhone.trim(),
          email: patientEmail.trim() || undefined,
          nutritional_goal: nutritionalGoal,
          subscription_plan: 'free_trial',
          plan_slug: 'free_trial',
        })

        if (!res.success) {
          throw new Error(res.error || 'Erro ao realizar cadastro')
        }

        setPatientSuccess(true)
        toast.success('Cadastro realizado com sucesso! Verifique seu WhatsApp.')
      } else {
        // Plano Pago: Primeiro salva os dados do paciente com status trial/pendente
        // para garantir o registro do objetivo e contato, depois redireciona para a InfinitePay
        try {
          await registerPatient({
            name: patientName.trim(),
            phone: patientPhone.trim(),
            email: patientEmail.trim() || undefined,
            nutritional_goal: nutritionalGoal,
            subscription_plan: selectedPlan,
            plan_slug: selectedPlan,
          })
        } catch (err) {
          console.warn('[Auth] warning saving pre-checkout patient:', err)
        }

        // Localiza a URL de checkout (com webhook) ou fallback
        const matchingDbPlan = dbPlans.find((p) => p.slug === selectedPlan)
        let checkoutUrl = ''
        if (matchingDbPlan) {
          checkoutUrl = resolveCheckoutUrl(matchingDbPlan)
        }
        if (!checkoutUrl) {
          checkoutUrl = INFINITEPAY_FALLBACK_LINKS[selectedPlan] || ''
        }

        if (checkoutUrl) {
          toast.info('Redirecionando para o pagamento seguro na InfinitePay...')
          // Redireciona o paciente para a página de checkout
          window.location.href = checkoutUrl
        } else {
          toast.success('Cadastro realizado! O link de pagamento será enviado no seu WhatsApp.')
          setPatientSuccess(true)
        }
      }
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || 'Falha ao processar o cadastro'
      setPatientError(msg)
      toast.error(msg)
    } finally {
      setPatientSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <img src={closerLogo} alt="Nutri Responde" className="h-8 w-auto object-contain" />
          <span className="font-bold text-lg text-foreground tracking-tight hidden sm:inline">
            Nutri Responde
          </span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        {/* Toggle Sou Paciente / Sou Nutricionista */}
        <div className="w-full max-w-4xl mb-6">
          <div className="bg-muted/60 p-1.5 rounded-2xl flex items-center max-w-md mx-auto shadow-inner border border-border/50">
            <button
              type="button"
              onClick={() => {
                setRole('patient')
                setNutriError(null)
                setPatientError(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                role === 'patient'
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HeartHandshake className="h-4 w-4 text-emerald-600" />
              Sou Paciente
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('nutri')
                setNutriError(null)
                setPatientError(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                role === 'nutri'
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Stethoscope className="h-4 w-4 text-primary" />
              Sou Nutricionista
            </button>
          </div>
        </div>

        {/* ── ABA NUTRICIONISTA (LOGIN / CADASTRO DR. CAIO) ── */}
        {role === 'nutri' && (
          <Card className="w-full max-w-md shadow-elevation border border-border/40 rounded-[2rem] animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="space-y-2 text-center pb-6">
              <div className="mx-auto bg-primary/10 text-primary w-12 h-12 rounded-2xl flex items-center justify-center mb-2">
                <Stethoscope className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {mode === 'signin' ? 'Acesso do Nutricionista' : 'Criar Conta de Nutricionista'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {mode === 'signin'
                  ? 'Acesse o painel clínico e gerencie seus pacientes'
                  : 'Cadastre sua conta para gerenciar pacientes e assistente Yasa'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNutriSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email_label')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="caiocandidonutri@hotmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password_label')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
                {nutriError && <p className="text-sm text-red-500 font-medium">{nutriError}</p>}
                <Button
                  type="submit"
                  className="w-full rounded-xl h-12 font-medium"
                  disabled={nutriSubmitting}
                >
                  {nutriSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : mode === 'signin' ? (
                    t('sign_in')
                  ) : (
                    t('get_started')
                  )}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin')
                    setNutriError(null)
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  {mode === 'signin' ? t('no_account_signup') : t('have_account_signin')}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── ABA PACIENTE (ONBOARDING + SELEÇÃO DE PLANO) ── */}
        {role === 'patient' && (
          <div className="w-full max-w-5xl animate-in fade-in zoom-in-95 duration-300">
            {patientSuccess ? (
              <Card className="max-w-xl mx-auto shadow-elevation border border-border/40 rounded-[2rem] text-center p-8 md:p-12">
                <div className="mx-auto bg-emerald-100 text-emerald-600 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight mb-3">
                  Parabéns, {patientName.split(' ')[0]}! 🎉
                </h2>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                  Seu cadastro foi realizado com sucesso. O Dr. Caio Cândido e sua assistente Yasa
                  já enviaram uma mensagem no seu WhatsApp (<strong>{patientPhone}</strong>).
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 text-left">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    💬 Mensagem enviada para você:
                  </p>
                  <p className="text-sm text-emerald-950 italic">
                    "Olá {patientName}! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri
                    Responde! Sua assistente Yasa já está pronta para te ajudar. Que tal começar me
                    contando qual é o seu principal objetivo? 💚"
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      const cleanPhone = patientPhone.replace(/\D/g, '')
                      window.open(
                        `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}`,
                        '_blank',
                      )
                    }}
                    className="rounded-full h-12 px-6 bg-whatsapp-green hover:bg-whatsapp-green/90 text-white font-bold"
                  >
                    Abrir WhatsApp agora
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPatientSuccess(false)
                      setPatientName('')
                      setPatientPhone('')
                      setPatientEmail('')
                    }}
                    className="rounded-full h-12 px-6"
                  >
                    Novo cadastro
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-8">
                <div className="text-center max-w-2xl mx-auto">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                    Acompanhamento Nutricional Inteligente
                  </h1>
                  <p className="text-muted-foreground mt-2 text-base">
                    Preencha seus dados abaixo e escolha o melhor plano para iniciar seu
                    acompanhamento direto com a <strong>Yasa</strong>, sua assistente 24h
                    supervisionada pelo Dr. Caio Cândido.
                  </p>
                </div>

                <form onSubmit={handlePatientSubmit} className="space-y-8">
                  {/* Etapa 1: Dados do Paciente */}
                  <Card className="border border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 pb-4 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          1
                        </span>
                        <div>
                          <CardTitle className="text-xl">Seus Dados Pessoais</CardTitle>
                          <CardDescription>
                            Para conectarmos você à Yasa no WhatsApp
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="pt_name" className="font-semibold text-sm">
                            Nome Completo *
                          </Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="pt_name"
                              type="text"
                              required
                              placeholder="Ex.: Carolina Mendes"
                              value={patientName}
                              onChange={(e) => setPatientName(e.target.value)}
                              className="pl-10 h-12 rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pt_phone" className="font-semibold text-sm">
                            WhatsApp com DDD *
                          </Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="pt_phone"
                              type="tel"
                              required
                              placeholder="(11) 98765-4321"
                              value={patientPhone}
                              onChange={(e) => setPatientPhone(e.target.value)}
                              className="pl-10 h-12 rounded-xl"
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Você receberá o convite da Yasa neste número.
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="pt_email" className="font-semibold text-sm">
                            E-mail (opcional)
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="pt_email"
                              type="email"
                              placeholder="carol@exemplo.com"
                              value={patientEmail}
                              onChange={(e) => setPatientEmail(e.target.value)}
                              className="pl-10 h-12 rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pt_goal" className="font-semibold text-sm">
                            Principal Objetivo Nutricional *
                          </Label>
                          <div className="relative">
                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <select
                              id="pt_goal"
                              value={nutritionalGoal}
                              onChange={(e) => setNutritionalGoal(e.target.value)}
                              className="flex h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                            >
                              {NUTRITIONAL_GOALS.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Etapa 2: Escolha do Plano */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        2
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Escolha o seu plano</h3>
                        <p className="text-sm text-muted-foreground">
                          Selecione o período de acompanhamento desejado.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {STATIC_PLANS.map((plan) => {
                        const isSelected = selectedPlan === plan.slug
                        return (
                          <div
                            key={plan.slug}
                            onClick={() => setSelectedPlan(plan.slug)}
                            className={`relative cursor-pointer rounded-[1.75rem] p-5 border-2 transition-all flex flex-col justify-between bg-card hover:shadow-elevation ${
                              isSelected
                                ? 'border-primary shadow-elevation ring-2 ring-primary/20'
                                : 'border-border/60 hover:border-primary/50'
                            }`}
                          >
                            {plan.popular && (
                              <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                <Sparkles className="h-3 w-3" /> Mais popular
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl">{plan.icon}</span>
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-muted-foreground/40'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                              </div>

                              <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 min-h-[32px]">
                                {plan.description}
                              </p>

                              <div className="my-4">
                                <span className="text-2xl font-extrabold text-foreground">
                                  {plan.priceFormatted}
                                </span>
                                {plan.priceNum > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {' '}
                                    / {plan.durationFormatted}
                                  </span>
                                )}
                              </div>

                              <Badge
                                variant={isSelected ? 'default' : 'secondary'}
                                className="mb-4 text-[11px] font-semibold w-full justify-center py-1"
                              >
                                {plan.messageLimitLabel}
                              </Badge>

                              <div className="space-y-2 text-xs border-t border-border/40 pt-3">
                                {plan.features.map((f, i) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    {f.included ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                      <X className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    )}
                                    <span
                                      className={
                                        f.included
                                          ? 'text-foreground font-medium'
                                          : 'text-muted-foreground line-through'
                                      }
                                    >
                                      {f.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {patientError && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-medium text-center">
                      {patientError}
                    </div>
                  )}

                  {/* CTA Final */}
                  <div className="flex flex-col items-center justify-center pt-2">
                    <Button
                      type="submit"
                      disabled={patientSubmitting}
                      className="w-full max-w-md h-14 rounded-full text-base font-bold shadow-elevation transition-all hover:scale-[1.01]"
                    >
                      {patientSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processando cadastro...
                        </>
                      ) : selectedPlan === 'free_trial' ? (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Começar agora grátis (3 mensagens)
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-5 w-5" />
                          Começar agora · Pagamento Seguro
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      🔒 Pagamento criptografado via InfinitePay · Sem fidelidade · Acesso imediato
                      no WhatsApp
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
