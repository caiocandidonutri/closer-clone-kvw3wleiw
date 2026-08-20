import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  MessageCircle,
  Camera,
  ShoppingCart,
  ClipboardList,
  ShieldCheck,
  Check,
  X,
  Menu,
  CalendarClock,
  Wallet,
  Frown,
  UserPlus,
  LineChart,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { usePlans } from '@/hooks/use-patients'
import { getPublicStats, type PublicStats } from '@/services/patients'
import { INFINITEPAY_FALLBACK_LINKS, resolveCheckoutUrl } from '@/lib/infinitepay'
import type { SubscriptionPlanSlug } from '@/lib/types'

export default function Index() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const { plans: dbPlans } = usePlans()
  const [menuOpen, setMenuOpen] = useState(false)
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    let mounted = true
    getPublicStats()
      .then((data) => {
        if (mounted) {
          setStats(data)
          setLoadingStats(false)
        }
      })
      .catch((err) => {
        console.warn('Failed to load public stats, using fallback:', err)
        if (mounted) {
          setLoadingStats(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  if (!loading && user) {
    return <Navigate to="/app" replace />
  }

  // Map slug → API-generated InfinitePay link (with webhook configured).
  // Falls back to the manual dashboard links only when the API link is absent.
  const planLinks: Partial<Record<SubscriptionPlanSlug, string>> = {}
  for (const p of dbPlans) {
    planLinks[p.slug as SubscriptionPlanSlug] = resolveCheckoutUrl(p)
  }
  const linkFor = (slug: SubscriptionPlanSlug) =>
    planLinks[slug] || INFINITEPAY_FALLBACK_LINKS[slug] || ''

  const navLinks = [
    { href: '#funcionalidades', label: t('nav_features') },
    { href: '#como-funciona', label: t('nav_how') },
    { href: '#planos', label: t('nav_pricing') },
  ]

  const problems = [
    { icon: Frown, text: t('problem_1') },
    { icon: MessageCircle, text: t('problem_2') },
    { icon: Wallet, text: t('problem_3') },
    { icon: CalendarClock, text: t('problem_4') },
    { icon: LineChart, text: t('problem_5') },
    { icon: MessageCircle, text: t('problem_6') },
  ]

  const withoutItems = [
    t('beforeafter_without_1'),
    t('beforeafter_without_2'),
    t('beforeafter_without_3'),
    t('beforeafter_without_4'),
    t('beforeafter_without_5'),
  ]
  const withItems = [
    t('beforeafter_with_1'),
    t('beforeafter_with_2'),
    t('beforeafter_with_3'),
    t('beforeafter_with_4'),
    t('beforeafter_with_5'),
  ]

  const steps = [
    {
      n: '01',
      title: t('how_step1_title'),
      desc: t('how_step1_desc'),
      icon: UserPlus,
    },
    {
      n: '02',
      title: t('how_step2_title'),
      desc: t('how_step2_desc'),
      icon: MessageCircle,
    },
    {
      n: '03',
      title: t('how_step3_title'),
      desc: t('how_step3_desc'),
      icon: LineChart,
    },
  ]

  const features = [
    {
      icon: MessageCircle,
      title: t('feature_chat_title'),
      desc: t('feature_chat_desc'),
    },
    {
      icon: Camera,
      title: t('feature_photo_title'),
      desc: t('feature_photo_desc'),
    },
    {
      icon: ClipboardList,
      title: t('feature_plan_title'),
      desc: t('feature_plan_desc'),
    },
    {
      icon: ShoppingCart,
      title: t('feature_list_title'),
      desc: t('feature_list_desc'),
    },
  ]

  const plans = [
    {
      name: t('pricing_trial_name'),
      price: t('pricing_trial_price'),
      period: t('pricing_trial_period'),
      badge: t('pricing_trial_badge'),
      cta: t('pricing_cta_trial'),
      href: '/auth',
      external: false,
      features: [
        t('pricing_trial_1'),
        t('pricing_trial_2'),
        t('pricing_trial_3'),
        t('pricing_trial_4'),
      ],
      highlight: false,
    },
    {
      name: t('pricing_weekly_name'),
      price: t('pricing_weekly_price'),
      period: t('pricing_weekly_period'),
      badge: t('pricing_weekly_badge'),
      cta: t('pricing_cta_weekly'),
      href: linkFor('weekly'),
      external: true,
      features: [
        t('pricing_weekly_1'),
        t('pricing_weekly_2'),
        t('pricing_weekly_3'),
        t('pricing_weekly_4'),
        t('pricing_weekly_5'),
        t('pricing_weekly_6'),
      ],
      highlight: true,
    },
    {
      name: t('pricing_monthly_name'),
      price: t('pricing_monthly_price'),
      period: t('pricing_monthly_period'),
      badge: t('pricing_monthly_badge'),
      cta: t('pricing_cta_monthly'),
      href: linkFor('monthly'),
      external: true,
      features: [
        t('pricing_monthly_1'),
        t('pricing_monthly_2'),
        t('pricing_monthly_3'),
        t('pricing_monthly_4'),
        t('pricing_monthly_5'),
      ],
      highlight: false,
    },
    {
      name: t('pricing_quarterly_name'),
      price: t('pricing_quarterly_price'),
      period: t('pricing_quarterly_period'),
      badge: t('pricing_quarterly_badge'),
      cta: t('pricing_cta_quarterly'),
      href: linkFor('quarterly'),
      external: true,
      features: [
        t('pricing_quarterly_1'),
        t('pricing_quarterly_2'),
        t('pricing_quarterly_3'),
        t('pricing_quarterly_4'),
        t('pricing_quarterly_5'),
        t('pricing_quarterly_6'),
      ],
      highlight: false,
    },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-foreground">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-whatsapp-green text-white shadow-glow">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-whatsapp-dark">
              Dr. Caio Cândido
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-whatsapp-dark"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              asChild
              className="rounded-full font-medium text-whatsapp-dark hover:bg-whatsapp-green/10"
            >
              <Link to="/auth">{t('sign_in')}</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-whatsapp-green px-5 font-semibold text-white shadow-glow transition-all hover:bg-whatsapp-green/90 hover:shadow-floating"
            >
              <Link to="/auth">{t('hero_cta_trial')}</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-whatsapp-dark"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="border-t border-border/60 bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-whatsapp-green/10 hover:text-whatsapp-dark"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Button variant="outline" asChild className="rounded-full font-medium">
                  <Link to="/auth">{t('sign_in')}</Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full bg-whatsapp-green font-semibold text-white shadow-glow"
                >
                  <Link to="/auth">{t('hero_cta_trial')}</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden bg-gradient-to-b from-whatsapp-green/5 via-white to-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-whatsapp-green/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-whatsapp-teal/10 blur-3xl" />
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-whatsapp-green/30 bg-whatsapp-green/10 px-4 py-1.5 text-xs font-medium text-whatsapp-dark">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('hero_badge')}
              </div>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-whatsapp-dark sm:text-5xl md:text-6xl">
                {t('hero_title')}
              </h1>
              <p className="mt-5 text-lg font-medium text-whatsapp-teal sm:text-xl">
                {t('hero_subtitle')}
              </p>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t('hero_description')}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-14 w-full rounded-full bg-whatsapp-green px-8 text-base font-semibold text-white shadow-glow transition-all hover:bg-whatsapp-green/90 hover:shadow-floating sm:w-auto"
                >
                  <Link to="/auth">
                    {t('hero_cta_trial')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-whatsapp-green" />
                  {t('hero_trust_card')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-whatsapp-green" />
                  {t('hero_trust_patients')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-whatsapp-green" />
                  {t('hero_trust_cancel')}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  value: loadingStats ? '...' : stats !== null ? `${stats.patients_count}` : '8',
                  label: t('stat_patients'),
                },
                {
                  value: loadingStats ? '...' : stats !== null ? `${stats.active_contacts}` : '7',
                  label: t('stat_active_contacts'),
                },
                {
                  value: loadingStats ? '...' : stats !== null ? `${stats.messages_count}` : '35',
                  label: t('stat_messages'),
                },
                {
                  value: '24/7',
                  label: t('stat_support'),
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border/60 bg-white p-5 text-center shadow-subtle transition-all hover:shadow-elevation"
                >
                  <div className="text-2xl font-extrabold text-whatsapp-green sm:text-3xl">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Problem ===== */}
        <section className="bg-whatsapp-dark py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-green">
                {t('problem_eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t('problem_title')}
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
                {t('problem_intro')}
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {problems.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp-green/20 text-whatsapp-green">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium leading-relaxed text-white/90">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Before / After ===== */}
        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-teal">
                {t('beforeafter_eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-whatsapp-dark sm:text-4xl">
                {t('beforeafter_title')}
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* Without */}
              <Card className="rounded-3xl border border-border/60 bg-muted/40 p-7 shadow-subtle">
                <h3 className="text-lg font-bold text-muted-foreground">
                  {t('beforeafter_without_title')}
                </h3>
                <ul className="mt-6 space-y-4">
                  {withoutItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                        <X className="h-4 w-4" />
                      </span>
                      <span className="text-sm leading-relaxed text-foreground/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              {/* With */}
              <Card className="relative rounded-3xl border border-whatsapp-green/30 bg-whatsapp-green/5 p-7 shadow-elevation">
                <div className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-whatsapp-green px-3 py-1 text-xs font-semibold text-white shadow-glow">
                  <Sparkles className="h-3 w-3" />
                  {t('beforeafter_with_title')}
                </div>
                <h3 className="mt-2 text-lg font-bold text-whatsapp-dark">
                  {t('beforeafter_with_title')}
                </h3>
                <ul className="mt-6 space-y-4">
                  {withItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-whatsapp-green text-white">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium leading-relaxed text-foreground">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* ===== How it works ===== */}
        <section id="como-funciona" className="bg-whatsapp-green/5 py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-teal">
                {t('how_eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-whatsapp-dark sm:text-4xl">
                {t('how_title')}
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div
                  key={s.n}
                  className="group relative rounded-3xl border border-border/60 bg-white p-7 shadow-subtle transition-all hover:-translate-y-1 hover:shadow-elevation"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-whatsapp-green/10 text-whatsapp-green transition-colors group-hover:bg-whatsapp-green group-hover:text-white">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <span className="text-4xl font-extrabold text-whatsapp-green/20">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-whatsapp-dark">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-whatsapp-green px-8 font-semibold text-white shadow-glow transition-all hover:bg-whatsapp-green/90 hover:shadow-floating"
              >
                <Link to="/auth">
                  {t('how_cta')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===== Features ===== */}
        <section id="funcionalidades" className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-teal">
                {t('features_eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-whatsapp-dark sm:text-4xl">
                {t('features_title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t('features_subtitle')}
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <Card
                  key={f.title}
                  className="group rounded-3xl border border-border/60 bg-white p-7 shadow-subtle transition-all hover:-translate-y-1 hover:border-whatsapp-green/40 hover:shadow-elevation"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-whatsapp-green/10 text-whatsapp-green transition-colors group-hover:bg-whatsapp-green group-hover:text-white">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-base font-bold text-whatsapp-dark">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Pricing ===== */}
        <section id="planos" className="bg-whatsapp-green/5 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-teal">
                {t('pricing_eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-whatsapp-dark sm:text-4xl">
                {t('pricing_title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t('pricing_subtitle')}
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((p) => {
                const isExclusion = (f: string) => f.indexOf('❌') >= 0
                const ctaInner = (
                  <>
                    {p.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )
                return (
                  <Card
                    key={p.name}
                    className={`relative flex flex-col rounded-3xl border p-7 shadow-subtle transition-all hover:shadow-elevation ${
                      p.highlight
                        ? 'border-whatsapp-green bg-whatsapp-dark text-white shadow-elevation'
                        : 'border-border/60 bg-white'
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-whatsapp-green px-4 py-1 text-xs font-semibold text-white shadow-glow">
                        {t('pricing_popular')}
                      </div>
                    )}
                    <span
                      className={`text-xs font-medium ${
                        p.highlight ? 'text-whatsapp-green' : 'text-whatsapp-teal'
                      }`}
                    >
                      {p.badge}
                    </span>
                    <h3
                      className={`mt-2 text-xl font-bold ${
                        p.highlight ? 'text-white' : 'text-whatsapp-dark'
                      }`}
                    >
                      {p.name}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span
                        className={`text-4xl font-extrabold ${
                          p.highlight ? 'text-white' : 'text-whatsapp-dark'
                        }`}
                      >
                        {p.price}
                      </span>
                      <span
                        className={`text-sm ${
                          p.highlight ? 'text-white/60' : 'text-muted-foreground'
                        }`}
                      >
                        {p.period}
                      </span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          {isExclusion(f) ? (
                            <X
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                p.highlight ? 'text-white/40' : 'text-muted-foreground'
                              }`}
                            />
                          ) : (
                            <Check
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                p.highlight ? 'text-whatsapp-green' : 'text-whatsapp-green'
                              }`}
                            />
                          )}
                          <span
                            className={`text-sm leading-relaxed ${
                              isExclusion(f)
                                ? p.highlight
                                  ? 'text-white/50 line-through'
                                  : 'text-muted-foreground line-through'
                                : p.highlight
                                  ? 'text-white/85'
                                  : 'text-foreground/80'
                            }`}
                          >
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className={`mt-7 w-full rounded-full font-semibold transition-all ${
                        p.highlight
                          ? 'bg-whatsapp-green text-white shadow-glow hover:bg-whatsapp-green/90'
                          : 'bg-whatsapp-dark text-white hover:bg-whatsapp-dark/90'
                      }`}
                    >
                      {p.external ? (
                        <a href={p.href} target="_blank" rel="noopener noreferrer">
                          {ctaInner}
                        </a>
                      ) : (
                        <Link to={p.href}>{ctaInner}</Link>
                      )}
                    </Button>
                  </Card>
                )
              })}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">{t('pricing_note')}</p>
          </div>
        </section>

        {/* ===== Final CTA ===== */}
        <section className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-whatsapp-dark px-6 py-14 text-center shadow-floating sm:px-12">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-whatsapp-green/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-whatsapp-teal/20 blur-3xl" />
              <span className="text-xs font-semibold uppercase tracking-widest text-whatsapp-green">
                {t('final_eyebrow')}
              </span>
              <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t('final_title')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                {t('final_desc')}
              </p>
              <div className="mt-8 flex justify-center">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-whatsapp-green px-8 text-base font-semibold text-white shadow-glow transition-all hover:bg-whatsapp-green/90 hover:shadow-floating"
                >
                  <Link to="/auth">
                    {t('final_cta')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-white/50">{t('final_note')}</p>
            </div>
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border/60 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-whatsapp-green text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-whatsapp-dark">Dr. Caio Cândido</div>
              <div className="text-xs text-muted-foreground">{t('footer_tagline')}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Dr. Caio Cândido. {t('footer_rights')}
          </p>
        </div>
      </footer>
    </div>
  )
}
