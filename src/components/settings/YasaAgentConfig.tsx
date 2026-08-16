import { useState, useEffect } from 'react'
import { useYasaConfig } from '@/hooks/use-yasa-config'
import { useLanguage } from '@/hooks/use-language'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Sparkles, KeyRound, Thermometer, Clock } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type Tone = 'leve' | 'formal'
type Detail = 'curto' | 'detalhado'
type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'

export function YasaAgentConfig() {
  const { config, loading, saving, save } = useYasaConfig()
  const { t } = useLanguage()

  const [form, setForm] = useState({
    agent_name: '',
    nutritionist_name: '',
    specialty: '',
    welcome_message: '',
    tone: 'leve' as Tone,
    detail_level: 'detalhado' as Detail,
    preferred_topics: '',
    general_guidelines: '',
    is_active: true,
    openai_api_key: '',
    gemini_model: 'gpt-4o' as OpenAIModel,
    temperature: 0.7,
    max_response_seconds: 30,
  })

  useEffect(() => {
    if (config) {
      const topics = Array.isArray(config.preferred_topics)
        ? config.preferred_topics.join(', ')
        : ''
      setForm({
        agent_name: config.agent_name || '',
        nutritionist_name: config.nutritionist_name || '',
        specialty: config.specialty || '',
        welcome_message: config.welcome_message || '',
        tone: (config.tone as Tone) || 'leve',
        detail_level: (config.detail_level as Detail) || 'detalhado',
        preferred_topics: topics,
        general_guidelines: config.general_guidelines || '',
        is_active: config.is_active ?? true,
        openai_api_key: config.openai_api_key || '',
        gemini_model: (config.gemini_model as OpenAIModel) || 'gpt-4o',
        temperature:
          typeof config.temperature === 'number' && config.temperature !== null
            ? config.temperature
            : 0.7,
        max_response_seconds:
          typeof config.max_response_seconds === 'number' && config.max_response_seconds
            ? config.max_response_seconds
            : 30,
      })
    }
  }, [config])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const topics = form.preferred_topics
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    await save({
      agent_name: form.agent_name,
      nutritionist_name: form.nutritionist_name,
      specialty: form.specialty,
      welcome_message: form.welcome_message,
      tone: form.tone,
      detail_level: form.detail_level,
      preferred_topics: topics,
      general_guidelines: form.general_guidelines,
      is_active: form.is_active,
      openai_api_key: form.openai_api_key,
      gemini_model: form.gemini_model,
      temperature: Number(form.temperature),
      max_response_seconds: Number(form.max_response_seconds),
    })
  }

  if (loading || !config) {
    return (
      <Card className="border-border/40 shadow-subtle rounded-[2rem]">
        <CardContent className="flex justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl tracking-tight">{t('yasa_section_title')}</CardTitle>
            <CardDescription className="mt-1">{t('yasa_section_desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 md:p-8 space-y-10">
          {/* Identidade */}
          <section className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t('yasa_identity_title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="yasa_name" className="font-semibold">
                  {t('yasa_agent_name')}
                </Label>
                <Input
                  id="yasa_name"
                  value={form.agent_name}
                  onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yasa_nutri" className="font-semibold">
                  {t('yasa_nutritionist')}
                </Label>
                <Input
                  id="yasa_nutri"
                  value={form.nutritionist_name}
                  onChange={(e) => setForm({ ...form, nutritionist_name: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yasa_spec" className="font-semibold">
                {t('yasa_specialty')}
              </Label>
              <Input
                id="yasa_spec"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yasa_welcome" className="font-semibold">
                {t('yasa_welcome')}
              </Label>
              <Textarea
                id="yasa_welcome"
                value={form.welcome_message}
                onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                className="rounded-xl min-h-[90px] resize-none"
              />
            </div>
          </section>

          {/* Tom & Estilo */}
          <section className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t('yasa_behavior_title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="font-semibold">{t('yasa_tone')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['leve', 'formal'] as Tone[]).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setForm({ ...form, tone })}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-sm font-semibold transition-all',
                        form.tone === tone
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {tone === 'leve' ? t('yasa_tone_leve') : t('yasa_tone_formal')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">{t('yasa_detail')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['curto', 'detalhado'] as Detail[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm({ ...form, detail_level: d })}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-sm font-semibold transition-all',
                        form.detail_level === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {d === 'curto' ? t('yasa_detail_curto') : t('yasa_detail_detalhado')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Temas & Diretrizes */}
          <section className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t('yasa_topics_title')}
            </h3>
            <div className="space-y-2">
              <Label htmlFor="yasa_topics" className="font-semibold">
                {t('yasa_topics')}
              </Label>
              <Input
                id="yasa_topics"
                value={form.preferred_topics}
                onChange={(e) => setForm({ ...form, preferred_topics: e.target.value })}
                placeholder="emagrecimento, ganho de massa, nutrição esportiva"
                className="rounded-xl h-12"
              />
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('yasa_topics_help')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yasa_guide" className="font-semibold">
                {t('yasa_guidelines')}
              </Label>
              <Textarea
                id="yasa_guide"
                value={form.general_guidelines}
                onChange={(e) => setForm({ ...form, general_guidelines: e.target.value })}
                className="rounded-xl min-h-[120px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('yasa_guidelines_help')}
              </p>
            </div>
          </section>

          {/* Ativo */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/60">
            <div className="space-y-0.5">
              <Label className="font-semibold">{t('yasa_active')}</Label>
              <p className="text-xs text-muted-foreground">{t('yasa_active_help')}</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
            />
          </div>

          {/* Provedor de IA — OpenAI */}
          <section className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t('yasa_openai_section')}
            </h3>
            {!form.openai_api_key && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('yasa_openai_key_missing')}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="openai_key" className="font-semibold">
                {t('yasa_openai_key')}
              </Label>
              <Input
                id="openai_key"
                type="password"
                value={form.openai_api_key}
                onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })}
                placeholder="sk-..."
                className="rounded-xl h-12 font-mono"
              />
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('yasa_openai_key_help')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="openai_model" className="font-semibold">
                  {t('yasa_openai_model')}
                </Label>
                <select
                  id="openai_model"
                  value={form.gemini_model}
                  onChange={(e) =>
                    setForm({ ...form, gemini_model: e.target.value as OpenAIModel })
                  }
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="gpt-4o">GPT-4o (padrão, leitura de imagem)</option>
                  <option value="gpt-4o-mini">GPT-4o mini (rápido e econômico)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo (avançado)</option>
                </select>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('yasa_openai_model_help')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openai_time" className="font-semibold">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />
                  {t('yasa_openai_max_time')}
                </Label>
                <Input
                  id="openai_time"
                  type="number"
                  min={5}
                  max={120}
                  step={1}
                  value={form.max_response_seconds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_response_seconds: parseInt(e.target.value, 10) || 30,
                    })
                  }
                  className="rounded-xl h-12"
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('yasa_openai_max_time_help')}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="openai_temp" className="font-semibold">
                  <Thermometer className="inline h-3.5 w-3.5 mr-1" />
                  {t('yasa_openai_temperature')}
                </Label>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {form.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id="openai_temp"
                min={0}
                max={1}
                step={0.1}
                value={[form.temperature]}
                onValueChange={(vals) => setForm({ ...form, temperature: vals[0] ?? 0.7 })}
                className="py-2"
              />
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('yasa_openai_temperature_help')}
              </p>
            </div>
          </section>
        </CardContent>

        <div className="p-6 md:p-8 pt-4 border-t border-border/40 bg-muted/20 flex justify-end">
          <Button type="submit" disabled={saving} className="rounded-full px-8 shadow-subtle">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('yasa_save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
