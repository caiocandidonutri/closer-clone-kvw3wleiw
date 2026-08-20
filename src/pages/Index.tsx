import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
  Zap,
  MessageSquare,
  Award,
  ChevronRight,
  ExternalLink,
  Bot,
  Heart,
  Calendar,
  Utensils,
  BookOpen,
  Apple,
  ShoppingBag,
  Refrigerator,
  Flame,
  Clock,
  ChevronDown,
  Star,
  Users,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getPublicSubscriptionPlans, getPublicStats, PublicStats } from '@/services/patients'
import { SubscriptionPlan, FALLBACK_PLANS, INFINITEPAY_LINKS } from '@/lib/infinitepay'

// ── Comparison Table Matrix ──
interface FeatureRow {
  name: string
  category?: string
  description: string
  free: boolean | string
  weekly: boolean | string
  monthly: boolean | string
  quarterly: boolean | string
}

const COMPARISON_FEATURES: FeatureRow[] = [
  {
    name: 'Limite de mensagens',
    description: 'Volume de interações com a IA',
    free: '3 mensagens',
    weekly: '15 mensagens',
    monthly: '25 msgs / dia',
    quarterly: '40 msgs / dia',
  },
  {
    name: 'Orientação nutricional básica',
    description: 'Dúvidas sobre alimentos, calorias e hábitos',
    free: true,
    weekly: true,
    monthly: true,
    quarterly: true,
  },
  {
    name: 'Receitas de lanches fit',
    description: 'Panquecas, cookies, bolos saudáveis e vitaminas',
    free: false,
    weekly: true,
    monthly: true,
    quarterly: true,
  },
  {
    name: 'Estratégia de marmitas (Meal Prep)',
    description: 'Planejamento de marmitas e refeições para toda a semana',
    free: false,
    weekly: false,
    monthly: true,
    quarterly: true,
  },
  {
    name: 'Lista de compras inteligente',
    description: 'Organização por seção de mercado com estimativa de custo',
    free: false,
    weekly: false,
    monthly: true,
    quarterly: true,
  },
  {
    name: 'Modo "O que tenho na geladeira"',
    description: 'Sugestões de refeições com o que você já tem em casa',
    free: false,
    weekly: false,
    monthly: true,
    quarterly: true,
  },
  {
    name: 'Acompanhamento premium',
    description: 'Suporte avançado para metas específicas',
    free: false,
    weekly: false,
    monthly: false,
    quarterly: true,
  },
  {
    name: 'Prioridade no WhatsApp',
    description: 'Respostas ultrarrápidas nos horários de pico',
    free: false,
    weekly: false,
    monthly: false,
    quarterly: true,
  },
  {
    name: 'Relatórios semanais de evolução',
    description: 'Consolidação de hábitos e progresso nutricional',
    free: false,
    weekly: false,
    monthly: false,
    quarterly: true,
  },
]

export default function Index() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS)
  const [stats, setStats] = useState<PublicStats>({
    total_patients: 184,
    active_subscribers: 142,
    total_messages: 24500,
  })
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    getPublicSubscriptionPlans()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          const order = ['free_trial', 'weekly', 'monthly', 'quarterly']
          const sorted = [...data].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
          setPlans(sorted)
        }
      })
      .catch(() => {})

    getPublicStats()
      .then((st) => {
        if (isMounted && st && (st.total_patients > 0 || st.active_subscribers > 0)) {
          setStats(st)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  const getPlanLink = (slug: string) => {
    if (slug === 'free_trial') return '/auth'
    if (slug === 'weekly') return INFINITEPAY_LINKS.weekly
    if (slug === 'monthly') return INFINITEPAY_LINKS.monthly
    if (slug === 'quarterly') return INFINITEPAY_LINKS.quarterly
    return '/auth'
  }

  const renderCellContent = (val: boolean | string) => {
    if (typeof val === 'string') {
      return (
        <span className="font-semibold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
          {val}
        </span>
      )
    }
    if (val === true) {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
          <Check className="w-4 h-4 stroke-[3]" />
        </div>
      )
    }
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 dark:bg-red-950/40 text-red-400 dark:text-red-400">
        <X className="w-4 h-4 stroke-[2.5]" />
      </div>
    )
  }

  const faqs = [
    {
      q: 'Como funciona o Free Trial de 3 mensagens?',
      a: 'Você se cadastra em menos de 1 minuto sem precisar de cartão de crédito. Imediatamente recebe 3 mensagens gratuitas para tirar dúvidas nutricionais no WhatsApp com a Yasa.',
    },
    {
      q: 'Qual a diferença entre o plano Semanal e o Mensal?',
      a: 'O plano Semanal libera 15 mensagens e acesso exclusivo a receitas práticas de lanches fits. Já o plano Mensal libera 25 mensagens por dia, receitas completas, estratégias de marmitas para toda a semana, lista de compras inteligente e o modo geladeira.',
    },
    {
      q: 'Como é feito o pagamento?',
      a: 'O pagamento é processado com total segurança via InfinitePay, aceitando Pix ou Cartão de Crédito. A liberação do seu WhatsApp com a Yasa é instantânea após a confirmação.',
    },
    {
      q: 'A Yasa substitui a consulta médica?',
      a: 'A Yasa é uma assistente nutricional inteligente que opera sob as diretrizes científicas do Dr. Caio Cândido para te ajudar no dia a dia com dúvidas, refeições e receitas. Ela não realiza diagnósticos médicos e sempre orienta acompanhamento clínico quando necessário.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-[#0B2E27] to-[#041B16] text-white selection:bg-emerald-500 selection:text-white font-sans">
      {/* ── TOP NAV BAR ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-emerald-950/80 border-b border-emerald-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-[#128C7E] flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6 text-emerald-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  Nutri Responde
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
                  IA Dr. Caio
                </Badge>
              </div>
              <p className="text-xs text-emerald-200/70 hidden sm:block">
                Sua Nutricionista Pessoal no WhatsApp
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-emerald-100/80">
            <a href="#como-funciona" className="hover:text-emerald-300 transition-colors">
              Como funciona
            </a>
            <a href="#planos" className="hover:text-emerald-300 transition-colors">
              Planos e Preços
            </a>
            <a href="#comparativo" className="hover:text-emerald-300 transition-colors">
              Comparativo
            </a>
            <a href="#depoimentos" className="hover:text-emerald-300 transition-colors">
              Resultados
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button
                variant="ghost"
                className="text-emerald-200 hover:text-white hover:bg-emerald-900/50 text-sm hidden sm:inline-flex"
              >
                Entrar
              </Button>
            </Link>
            <a href="#planos">
              <Button className="bg-[#25D366] hover:bg-[#1EBE5D] text-emerald-950 font-bold px-4 sm:px-6 shadow-lg shadow-emerald-500/20 rounded-full transition-all hover:scale-105 active:scale-95">
                Começar Grátis
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[450px] bg-gradient-to-tr from-[#128C7E]/30 via-emerald-500/20 to-emerald-300/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
        <div className="absolute -top-10 -right-10 w-96 h-96 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs sm:text-sm font-semibold backdrop-blur-sm shadow-inner animate-bounce">
              <Sparkles className="w-4 h-4 text-[#25D366]" />
              <span>🎁 3 MENSAGENS GRÁTIS NO TRIAL</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              <span className="text-emerald-200/90 font-normal">Sem cartão</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-400">
              Transforme sua alimentação com a{' '}
              <span className="text-[#25D366] drop-shadow-sm">Yasa AI</span>
            </h1>

            <p className="text-lg sm:text-xl text-emerald-100/85 max-w-2xl mx-auto leading-relaxed">
              Assistente nutricional 24h no seu WhatsApp, com a inteligência e o protocolo clínico
              orientado pelo{' '}
              <strong className="text-white font-semibold underline decoration-[#25D366] decoration-2 underline-offset-4">
                Dr. Caio Cândido
              </strong>
              .
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-emerald-950 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5 fill-emerald-950 text-emerald-950" />
                  <span>Comece grátis no WhatsApp</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#planos" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-6 text-base font-semibold border-emerald-600/50 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-800/50 hover:text-white rounded-2xl backdrop-blur-sm"
                >
                  Ver todos os planos
                </Button>
              </a>
            </div>

            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-emerald-200/80 border-t border-emerald-800/40 mt-8">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                <span>
                  + {stats.total_patients > 0 ? stats.total_patients : 180} pacientes acompanhados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                <span>Respostas em segundos 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                <span>Protocolo Dr. Caio Cândido</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA (3 PASSOS) ── */}
      <section
        id="como-funciona"
        className="py-20 bg-emerald-950/60 border-y border-emerald-900/50 relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">
              Simples e Sem Complicação
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Como funciona o Nutri Responde
            </h2>
            <p className="text-emerald-200/70 text-sm sm:text-base">
              Você não precisa baixar nenhum aplicativo. Tudo acontece direto no aplicativo de
              mensagens que você já usa todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="relative rounded-3xl bg-gradient-to-b from-emerald-900/40 to-emerald-950/60 p-8 border border-emerald-800/50 shadow-xl backdrop-blur-sm group hover:border-emerald-500/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 text-[#25D366] group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-8 text-4xl font-black text-emerald-800/30 select-none">
                01
              </div>
              <h3 className="text-xl font-bold text-white mb-2">1. Escolha seu plano</h3>
              <p className="text-emerald-200/70 text-sm leading-relaxed">
                Comece gratuitamente com 3 mensagens de teste ou escolha o plano que melhor se
                adapta à sua rotina alimentar.
              </p>
            </div>

            <div className="relative rounded-3xl bg-gradient-to-b from-emerald-900/40 to-emerald-950/60 p-8 border border-emerald-800/50 shadow-xl backdrop-blur-sm group hover:border-emerald-500/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 text-[#25D366] group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-8 text-4xl font-black text-emerald-800/30 select-none">
                02
              </div>
              <h3 className="text-xl font-bold text-white mb-2">2. Converse no WhatsApp</h3>
              <p className="text-emerald-200/70 text-sm leading-relaxed">
                Envie áudios, textos ou fotos do seu prato e do seu plano. A Yasa responde em
                segundos com orientações precisas e acolhedoras.
              </p>
            </div>

            <div className="relative rounded-3xl bg-gradient-to-b from-emerald-900/40 to-emerald-950/60 p-8 border border-emerald-800/50 shadow-xl backdrop-blur-sm group hover:border-emerald-500/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 text-[#25D366] group-hover:scale-110 transition-transform">
                <Heart className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-8 text-4xl font-black text-emerald-800/30 select-none">
                03
              </div>
              <h3 className="text-xl font-bold text-white mb-2">3. Transforme sua saúde</h3>
              <p className="text-emerald-200/70 text-sm leading-relaxed">
                Conquiste consistência com receitas práticas, marmitas organizadas e auxílio diário
                para nunca mais sair da dieta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARDS DE PLANOS (4 TIERS) ── */}
      <section id="planos" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 px-3 py-1 text-xs uppercase tracking-wider font-bold">
              Planos Transparentes
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Escolha a parceria perfeita para o seu objetivo
            </h2>
            <p className="text-emerald-200/70 text-sm sm:text-base">
              Acesso imediato no seu WhatsApp. Cancele ou altere a qualquer momento sem taxas
              escondidas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* 1. FREE TRIAL */}
            <div className="rounded-3xl bg-emerald-950/70 border border-slate-700/60 flex flex-col justify-between p-6 hover:border-slate-500 transition-all hover:shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Degustação
                  </span>
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px]">
                    3 dias
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Free Trial</h3>
                <p className="text-xs text-slate-400 mb-6 min-h-[32px]">
                  Teste a inteligência e agilidade da Yasa no seu WhatsApp.
                </p>

                <div className="mb-6 pb-6 border-b border-slate-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">R$ 0</span>
                    <span className="text-xs text-slate-400">/ 3 mensagens</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-1 font-medium">
                    3 mensagens no total para testar
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Benefícios:
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>3 mensagens no total</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Orientação nutricional básica</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-500">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem receitas</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-500">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem estratégia de marmitas</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-500">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem lista de compras</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-500">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem geladeira inteligente</span>
                    </li>
                  </ul>
                </div>
              </div>

              <Link to="/auth" className="w-full">
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl h-12 text-sm">
                  Começar Grátis
                </Button>
              </Link>
            </div>

            {/* 2. SEMANAL (MAIS ESCOLHIDO) */}
            <div className="relative rounded-3xl bg-gradient-to-b from-[#0e4438] to-[#072b23] border-2 border-[#25D366] flex flex-col justify-between p-6 shadow-2xl shadow-emerald-500/20 transform lg:-translate-y-2 transition-all hover:scale-[1.02]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="relative flex h-3 w-3 inline-flex">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#25D366]"></span>
                </span>
                <Badge className="bg-[#25D366] text-emerald-950 font-black border-none text-[11px] px-3.5 py-1 shadow-lg shadow-emerald-500/30 uppercase tracking-wider ml-1">
                  ⭐ Mais Escolhido
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4 mt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Início Rápido
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px]">
                    7 dias
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Semanal</h3>
                <p className="text-xs text-emerald-200/80 mb-6 min-h-[32px]">
                  Ideal para testar uma rotina completa com receitas de lanches saudáveis.
                </p>

                <div className="mb-6 pb-6 border-b border-emerald-700/50">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-emerald-300">R$</span>
                    <span className="text-3xl font-black text-white">29,90</span>
                    <span className="text-xs text-emerald-200/70">/ semana</span>
                  </div>
                  <p className="text-[11px] text-emerald-300 mt-1 font-medium">
                    15 mensagens no total
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    Benefícios:
                  </p>
                  <ul className="space-y-2.5 text-xs text-emerald-100">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>15 mensagens no total</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Orientação nutricional</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-[#25D366]">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>✅ Receitas de lanches (EXCLUSIVO)</span>
                    </li>
                    <li className="flex items-start gap-2 text-emerald-300/50">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem estratégia de marmitas</span>
                    </li>
                    <li className="flex items-start gap-2 text-emerald-300/50">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem lista de compras</span>
                    </li>
                    <li className="flex items-start gap-2 text-emerald-300/50">
                      <X className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                      <span>Sem geladeira inteligente</span>
                    </li>
                  </ul>
                </div>
              </div>

              <a
                href={getPlanLink('weekly')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-emerald-950 font-black rounded-2xl h-12 text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover:scale-105">
                  <span>Assinar Semanal</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>

            {/* 3. MENSAL */}
            <div className="rounded-3xl bg-emerald-950/80 border border-emerald-700/60 flex flex-col justify-between p-6 hover:border-emerald-500 transition-all hover:shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Mais Completo
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px]">
                    30 dias
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Mensal</h3>
                <p className="text-xs text-emerald-200/70 mb-6 min-h-[32px]">
                  Para quem quer constância, receitas completas e planejamento de marmitas.
                </p>

                <div className="mb-6 pb-6 border-b border-emerald-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-emerald-300">R$</span>
                    <span className="text-3xl font-black text-white">79,90</span>
                    <span className="text-xs text-emerald-200/70">/ mês</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-1 font-medium">
                    25 mensagens por dia
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    Benefícios:
                  </p>
                  <ul className="space-y-2.5 text-xs text-emerald-100">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>25 mensagens por dia</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Orientação nutricional</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Receitas de lanches</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-emerald-300">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Estratégia de marmitas + planos</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-emerald-300">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Lista de compras inteligente</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-emerald-300">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                      <span>Geladeira inteligente</span>
                    </li>
                  </ul>
                </div>
              </div>

              <a
                href={getPlanLink('monthly')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl h-12 text-sm flex items-center justify-center gap-2">
                  <span>Assinar Mensal</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>

            {/* 4. TRIMESTRAL (PREMIUM) */}
            <div className="rounded-3xl bg-gradient-to-b from-[#182a20] to-[#0d1c14] border-2 border-amber-400/70 flex flex-col justify-between p-6 shadow-xl shadow-amber-500/10 hover:border-amber-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    👑 Premium VIP
                  </span>
                  <Badge className="bg-amber-400/20 text-amber-200 border-amber-400/30 text-[11px]">
                    90 dias
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Trimestral</h3>
                <p className="text-xs text-amber-100/70 mb-6 min-h-[32px]">
                  Acompanhamento contínuo e prioritário para resultados definitivos.
                </p>

                <div className="mb-6 pb-6 border-b border-amber-900/50">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-amber-300">R$</span>
                    <span className="text-3xl font-black text-white">199,90</span>
                    <span className="text-xs text-amber-200/70">/ 3 meses</span>
                  </div>
                  <p className="text-[11px] text-amber-300 mt-1 font-medium">
                    40 mensagens por dia (Economia real)
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                    Tudo do Mensal e mais:
                  </p>
                  <ul className="space-y-2.5 text-xs text-amber-100/90">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>40 mensagens por dia</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Tudo liberado (Marmitas, lista, geladeira)</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-amber-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Acompanhamento premium</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-amber-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Prioridade no WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2 font-semibold text-amber-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Relatórios semanais</span>
                    </li>
                  </ul>
                </div>
              </div>

              <a
                href={getPlanLink('quarterly')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-emerald-950 font-black rounded-2xl h-12 text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                  <span>Assinar Trimestral</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TABELA COMPARATIVA INTERATIVA ── */}
      <section id="comparativo" className="py-20 bg-emerald-950/70 border-t border-emerald-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs uppercase tracking-wider font-bold">
              Comparação Detalhada
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Compare todos os recursos
            </h2>
            <p className="text-emerald-200/70 text-sm">
              Veja exatamente o que cada plano inclui e escolha o ideal para suas metas.
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-800/60 bg-emerald-900/20 backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-emerald-800/60 bg-emerald-950/90 text-xs sm:text-sm">
                    <th className="p-4 sm:p-6 font-bold text-white w-2/5">Recursos & Benefícios</th>
                    <th className="p-4 sm:p-6 font-bold text-center text-slate-300">
                      Free Trial
                      <div className="text-[11px] font-normal text-slate-400 mt-0.5">R$ 0</div>
                    </th>
                    <th className="p-4 sm:p-6 font-bold text-center text-[#25D366] bg-emerald-900/30">
                      Semanal ⭐
                      <div className="text-[11px] font-normal text-emerald-300 mt-0.5">
                        R$ 29,90
                      </div>
                    </th>
                    <th className="p-4 sm:p-6 font-bold text-center text-white">
                      Mensal
                      <div className="text-[11px] font-normal text-emerald-300 mt-0.5">
                        R$ 79,90
                      </div>
                    </th>
                    <th className="p-4 sm:p-6 font-bold text-center text-amber-300">
                      Trimestral 👑
                      <div className="text-[11px] font-normal text-amber-400 mt-0.5">R$ 199,90</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-800/40 text-xs sm:text-sm">
                  {COMPARISON_FEATURES.map((feat, idx) => (
                    <tr key={idx} className="hover:bg-emerald-800/20 transition-colors group">
                      <td className="p-4 sm:p-6">
                        <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                          {feat.name}
                        </div>
                        <div className="text-[11px] text-emerald-200/60 mt-0.5">
                          {feat.description}
                        </div>
                      </td>
                      <td className="p-4 sm:p-6 text-center">{renderCellContent(feat.free)}</td>
                      <td className="p-4 sm:p-6 text-center bg-emerald-900/20">
                        {renderCellContent(feat.weekly)}
                      </td>
                      <td className="p-4 sm:p-6 text-center">{renderCellContent(feat.monthly)}</td>
                      <td className="p-4 sm:p-6 text-center">
                        {renderCellContent(feat.quarterly)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 sm:p-6 bg-emerald-950/80 border-t border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-emerald-200/70">
                Precisa de ajuda para escolher? Fale com a Yasa no teste grátis.
              </span>
              <div className="flex gap-3 w-full sm:w-auto">
                <Link to="/auth" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    className="w-full border-emerald-600/50 text-emerald-200 hover:bg-emerald-900/50"
                  >
                    Testar Grátis
                  </Button>
                </Link>
                <a
                  href={INFINITEPAY_LINKS.weekly}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none"
                >
                  <Button className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-emerald-950 font-bold">
                    Assinar Semanal (⭐ Mais escolhido)
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL & NÚMEROS REAIS ── */}
      <section id="depoimentos" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-900/40 via-emerald-950/60 to-emerald-950/90 border border-emerald-700/40 p-8 sm:p-14 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
                  Resultados Reais
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                  Mais de{' '}
                  <span className="text-[#25D366]">
                    {stats.total_patients > 0 ? stats.total_patients : 180} pacientes
                  </span>{' '}
                  já confiam na Yasa diariamente
                </h2>
                <p className="text-emerald-200/75 text-sm leading-relaxed">
                  Pacientes que transformaram sua rotina alimentar, aprenderam a fazer escolhas
                  conscientes e contam com o apoio instantâneo de um protocolo clínico validado.
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <div className="flex -space-x-2 overflow-hidden">
                    <img
                      className="inline-block h-10 w-10 rounded-full ring-2 ring-emerald-950"
                      src="https://img.usecurling.com/ppl/128?gender=female&seed=42"
                      alt="Paciente"
                    />
                    <img
                      className="inline-block h-10 w-10 rounded-full ring-2 ring-emerald-950"
                      src="https://img.usecurling.com/ppl/128?gender=male&seed=15"
                      alt="Paciente"
                    />
                    <img
                      className="inline-block h-10 w-10 rounded-full ring-2 ring-emerald-950"
                      src="https://img.usecurling.com/ppl/128?gender=female&seed=99"
                      alt="Paciente"
                    />
                    <img
                      className="inline-block h-10 w-10 rounded-full ring-2 ring-emerald-950"
                      src="https://img.usecurling.com/ppl/128?gender=male&seed=84"
                      alt="Paciente"
                    />
                  </div>
                  <div className="text-xs">
                    <div className="flex text-amber-400">★★★★★</div>
                    <span className="text-emerald-200/80 font-medium">4.9/5 em satisfação</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-emerald-950/80 border border-emerald-800/50 p-5 space-y-2">
                  <div className="text-2xl sm:text-3xl font-black text-[#25D366]">24 horas</div>
                  <div className="text-xs font-semibold text-white">Disponibilidade total</div>
                  <p className="text-[11px] text-emerald-200/60">
                    Tire dúvidas sobre o que comer em restaurantes, viagens ou fins de semana.
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-950/80 border border-emerald-800/50 p-5 space-y-2">
                  <div className="text-2xl sm:text-3xl font-black text-amber-400">100%</div>
                  <div className="text-xs font-semibold text-white">Protocolo Dr. Caio</div>
                  <p className="text-[11px] text-emerald-200/60">
                    Respostas baseadas em evidências científicas e conduta médica/nutricional séria.
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-950/80 border border-emerald-800/50 p-5 space-y-2 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://img.usecurling.com/ppl/128?gender=female&seed=33"
                      alt="Juliana M."
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">Juliana M.</div>
                      <div className="text-[10px] text-emerald-300">
                        Assinante Plano Mensal há 3 meses
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-100/90 italic">
                    "O modo de estratégias de marmitas e a lista de compras salvaram meu domingo!
                    Economizo tempo no mercado e não furei a dieta nenhuma vez esse mês."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ACCORDION ── */}
      <section className="py-20 bg-emerald-950/50 border-t border-emerald-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
              Dúvidas Frequentes
            </Badge>
            <h2 className="text-3xl font-bold text-white">Perguntas comuns sobre os planos</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-emerald-900/20 border border-emerald-800/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full text-left p-5 font-semibold text-white flex items-center justify-between gap-4 hover:text-emerald-300 transition-colors"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-emerald-400 transition-transform ${expandedFaq === idx ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedFaq === idx && (
                  <div className="p-5 pt-0 text-xs sm:text-sm text-emerald-200/80 leading-relaxed border-t border-emerald-800/30">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ── */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Pronto para ter sua nutricionista 24h no WhatsApp?
          </h2>
          <p className="text-emerald-200/80 text-base max-w-xl mx-auto">
            Comece hoje mesmo com 3 mensagens gratuitas e experimente a transformação na sua
            alimentação.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/auth" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-emerald-950 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
              >
                Iniciar Teste Gratuito Agora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-emerald-900/60 bg-emerald-950/90 py-12 text-xs text-emerald-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-[#128C7E] flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-950" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">Nutri Responde</span>
              <p className="text-[11px] text-emerald-200/50">
                Orientação sob supervisão do Dr. Caio Cândido
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-emerald-200/70">
            <a href="#" className="hover:text-white transition-colors">
              Política de Privacidade
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Termos de Uso
            </a>
            <a
              href="mailto:contato@nutriresponde.com"
              className="hover:text-white transition-colors"
            >
              Contato & Suporte
            </a>
            <Link to="/auth" className="hover:text-white transition-colors">
              Área do Nutricionista
            </Link>
          </div>

          <p className="text-[11px] text-emerald-200/40 text-center md:text-right">
            © {new Date().getFullYear()} Nutri Responde. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
