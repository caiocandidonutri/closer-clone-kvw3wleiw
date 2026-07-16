import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, MessageCircle, Plug, Unplug, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import {
  Integration,
  connectWhatsapp,
  disconnectWhatsapp,
  deleteIntegration,
} from '@/services/integrations'
import { useLanguage } from '@/hooks/use-language'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ConnectionState =
  | 'idle'
  | 'generating'
  | 'scanning'
  | 'authenticating'
  | 'connected'
  | 'failed'
  | 'timeout'

interface IntegrationCardProps {
  integration: Integration
  onStatusChange: () => void
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { response?: { error?: string; message?: string }; message?: string }
    if (e.response?.error) return e.response.error
    if (e.response?.message) return e.response.message
    if (e.message) return e.message
  }
  return getErrorMessage(err)
}

export function IntegrationCard({ integration, onStatusChange }: IntegrationCardProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    integration.status === 'CONNECTED' ? 'connected' : 'idle',
  )

  const isConnected = integration.status === 'CONNECTED'

  useEffect(() => {
    if (isConnected && connectionState !== 'connected') {
      setConnectionState('connected')
      setQrCode(null)
      setError(null)
      setLoading(false)
    }
  }, [isConnected, connectionState])

  useRealtime('integrations', (e) => {
    if (e.record.id !== integration.id) return
    const newStatus = (e.record as Record<string, unknown>).status as string
    if (newStatus === 'CONNECTED') {
      setConnectionState('connected')
      setQrCode(null)
      setError(null)
      setLoading(false)
      onStatusChange()
    } else if (newStatus === 'DISCONNECTED') {
      if (connectionState === 'connected') {
        setConnectionState('idle')
        onStatusChange()
      } else if (connectionState === 'scanning') {
        setConnectionState('authenticating')
      }
    }
  })

  const handleConnect = useCallback(async () => {
    setLoading(true)
    setError(null)
    setQrCode(null)
    setConnectionState('generating')

    try {
      const data = await connectWhatsapp(integration.id)

      if (data.status === 'CONNECTED') {
        setQrCode(null)
        setConnectionState('connected')
        toast.success(t('connected') || 'WhatsApp connected!')
        onStatusChange()
      } else if (data.base64) {
        setQrCode(
          data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`,
        )
        setConnectionState('scanning')
        onStatusChange()
      } else if (data.error) {
        setError(data.error)
        setConnectionState('failed')
      } else {
        setError(t('qr_not_ready') || 'QR code not ready. Please try again.')
        setConnectionState('failed')
      }
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err)
      const isTimeout = errMsg.toLowerCase().includes('timeout')
      setError(errMsg)
      setConnectionState(isTimeout ? 'timeout' : 'failed')
    } finally {
      setLoading(false)
    }
  }, [integration.id, onStatusChange, t])

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await disconnectWhatsapp(integration.id)
      setQrCode(null)
      setConnectionState('idle')
      toast.success(t('disconnected_success') || 'WhatsApp disconnected')
      onStatusChange()
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteIntegration(integration.id)
      toast.success(t('integration_removed') || 'Integration removed')
      onStatusChange()
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleRetry = () => {
    setQrCode(null)
    setError(null)
    handleConnect()
  }

  const badgeMap: Record<ConnectionState, { label: string; cls: string }> = {
    connected: {
      label: t('connected') || 'Connected',
      cls: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
    generating: {
      label: t('generating_qr') || 'Generating QR...',
      cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    scanning: {
      label: t('scan_qr') || 'Scan QR Code',
      cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    },
    authenticating: {
      label: t('connecting') || 'Connecting...',
      cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
    failed: {
      label: t('connection_failed') || 'Connection Failed',
      cls: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
    timeout: {
      label: t('connection_timeout_short') || 'Timeout',
      cls: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
    idle: {
      label: t('disconnected') || 'Disconnected',
      cls: 'bg-muted text-muted-foreground border-border',
    },
  }

  const badge = badgeMap[connectionState]
  const showQr = (connectionState === 'scanning' || connectionState === 'authenticating') && qrCode
  const showError = connectionState === 'failed' || connectionState === 'timeout'

  return (
    <Card className="shadow-subtle border border-border/40 rounded-[2rem] bg-card overflow-hidden">
      <CardHeader className="pb-6 pt-8 px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-3 text-xl tracking-tight">
            <div
              className={cn(
                'p-2.5 rounded-2xl',
                isConnected ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground',
              )}
            >
              <MessageCircle className="h-5 w-5" />
            </div>
            {integration.name || 'WhatsApp Instance'}
          </CardTitle>
          <CardDescription className="font-medium text-sm text-muted-foreground max-w-sm">
            {integration.instance_name || '—'}
          </CardDescription>
        </div>
        <div
          className={cn(
            'self-start px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap',
            badge.cls,
          )}
        >
          {badge.label}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-8">
        {showError && error && (
          <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-destructive flex-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="ml-auto shrink-0 text-destructive"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('try_again') || 'Try Again'}
            </Button>
          </div>
        )}
        {showQr && (
          <div className="flex flex-col items-center justify-center p-8 border border-border/60 rounded-3xl bg-muted/20 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56" />
            </div>
            <h4 className="font-semibold text-foreground mb-1">
              {connectionState === 'authenticating'
                ? t('authenticating') || 'Authenticating...'
                : t('scan_to_connect') || 'Scan to connect'}
            </h4>
            <p className="text-sm font-medium text-muted-foreground text-center max-w-[250px]">
              {connectionState === 'authenticating'
                ? t('authenticating_desc') || 'Waiting for WhatsApp to confirm connection...'
                : t('scan_desc') || 'Open WhatsApp → Settings → Linked Devices'}
            </p>
            {connectionState === 'authenticating' && (
              <div className="flex items-center gap-2 mt-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('connecting') || 'Connecting...'}
                </span>
              </div>
            )}
          </div>
        )}
        {connectionState === 'generating' && (
          <div className="flex flex-col items-center justify-center p-8 min-h-[200px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {t('generating_qr') || 'Generating QR Code...'}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 border-t border-border/40 py-5 px-8 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <div className="text-sm font-medium text-muted-foreground text-center sm:text-left">
          {isConnected
            ? t('actively_connected') || 'Actively connected'
            : connectionState === 'idle'
              ? 'Configure this instance'
              : badge.label}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {showError && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={loading}
              className="rounded-full px-6 h-11 font-semibold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('try_again') || 'Try Again'}
            </Button>
          )}
          {isConnected ? (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-full px-6 h-11 font-semibold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              {t('disconnect') || 'Disconnect'}
            </Button>
          ) : (
            !showError && (
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="rounded-full px-6 h-11 font-semibold"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                {t('connect_whatsapp') || 'Connect'}
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="rounded-full h-11 w-11 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
