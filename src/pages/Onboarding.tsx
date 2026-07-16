import { useState, useEffect, useRef } from 'react'
import { useIntegration } from '@/hooks/use-integration'
import { useLanguage } from '@/hooks/use-language'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Smartphone,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { connectWhatsapp, type Integration } from '@/services/integrations'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const QR_TIMEOUT_MS = 20000

export default function Onboarding() {
  const { integrations, addIntegration, refreshIntegrations } = useIntegration()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [syncStatus, setSyncStatus] = useState('')
  const [currentIntegration, setCurrentIntegration] = useState<Integration | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncStarted = useRef(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      if (integrations.length > 0) {
        const connected = integrations.find((i) => i.status === 'CONNECTED')
        if (connected) {
          navigate('/app', { replace: true })
          return
        }
        setCurrentIntegration(integrations[0])
      } else {
        const newInteg = await addIntegration('WhatsApp')
        if (newInteg) setCurrentIntegration(newInteg)
      }
    }
    init()
  }, [integrations.length, addIntegration, navigate])

  useEffect(() => {
    if (!currentIntegration || step !== 1) return
    if (currentIntegration.status === 'CONNECTED') {
      setStep(2)
      return
    }
    fetchQR()
  }, [currentIntegration?.id, currentIntegration?.status, step])

  useRealtime('integrations', (e) => {
    if (!currentIntegration || e.record.id !== currentIntegration.id) return
    const newStatus = (e.record as Record<string, unknown>).status as string
    if (newStatus === 'CONNECTED' && step === 1) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setStep(2)
    }
  })

  const fetchQR = async () => {
    if (!currentIntegration?.id || loading) return
    setLoading(true)
    setError(null)
    setQrCode(null)

    timeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError(t('connection_timeout') || 'Connection timeout. Please try again.')
    }, QR_TIMEOUT_MS)

    try {
      const data = await connectWhatsapp(currentIntegration.id)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      if (data.status === 'CONNECTED') {
        setStep(2)
      } else if (data.base64) {
        setQrCode(
          data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`,
        )
      } else if (data.error) {
        setError(data.error)
      } else {
        setError(t('qr_not_ready') || 'QR code not ready. Please try again.')
      }
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setError(
        err?.response?.message || err?.message || t('failed_connect') || 'Failed to connect.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step === 2 && !syncStarted.current) {
      syncStarted.current = true
      handleSync()
    }
  }, [step])

  const handleSync = async () => {
    try {
      setSyncStatus(t('downloading_contacts'))
      setProgress(20)
      await new Promise((r) => setTimeout(r, 600))

      setSyncStatus(t('downloading_messages'))
      setProgress(50)
      await new Promise((r) => setTimeout(r, 600))

      setSyncStatus(t('ai_classifying'))
      setProgress(75)
      await new Promise((r) => setTimeout(r, 600))

      setProgress(100)
      setSyncStatus(t('setup_complete') || 'Setup Complete!')
      toast.success(t('onboarding_complete'))

      setTimeout(() => navigate('/app', { replace: true }), 1000)
    } catch (err: any) {
      toast.error(err?.message || t('sync_failed_onboarding'))
      setTimeout(() => navigate('/app', { replace: true }), 1500)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <Card className="shadow-elevation border border-border/40 rounded-[2.5rem] bg-card">
        <CardHeader className="text-center space-y-6 pb-6 pt-12">
          <div className="flex justify-center mb-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${step >= 1 ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
              >
                <Smartphone size={20} />
              </div>
              <div
                className={`w-10 h-0.5 transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border'}`}
              ></div>
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${step >= 2 ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
              >
                <BrainCircuit size={20} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight">
              {step === 1 && t('link_whatsapp')}
              {step === 2 && t('setting_up_crm')}
            </CardTitle>
            <CardDescription className="text-[15px] font-medium px-4 text-muted-foreground">
              {step === 1 && t('scan_qr_desc')}
              {step === 2 && t('please_wait_sync')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-10 pb-12">
          {step === 1 && (
            <div className="flex flex-col items-center py-4 space-y-8">
              {error ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl max-w-sm">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  </div>
                  <Button onClick={fetchQR} className="rounded-full px-6">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('try_again') || 'Try Again'}
                  </Button>
                </div>
              ) : qrCode ? (
                <div className="p-4 bg-white rounded-3xl shadow-elevation border border-border/40 animate-in fade-in zoom-in-95 duration-500">
                  <img src={qrCode} alt="WhatsApp QR" className="w-56 h-56 rounded-xl" />
                </div>
              ) : (
                <div className="w-64 h-64 bg-muted/50 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border gap-3">
                  <Loader2 className="animate-spin h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {t('generating_qr') || 'Generating QR Code...'}
                  </p>
                </div>
              )}
              {!error && (
                <p className="text-[13px] text-muted-foreground font-medium text-center max-w-xs leading-relaxed">
                  {t('open_whatsapp_scan')}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="py-10 space-y-8 text-center animate-in fade-in duration-500">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-center gap-3 text-lg font-semibold text-foreground">
                {progress >= 100 ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                {syncStatus}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
