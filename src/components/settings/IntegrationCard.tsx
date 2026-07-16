import { useState, useEffect, useRef, useCallback } from 'react'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  integration: Integration
  onStatusChange: () => void
}

export function IntegrationCard({ integration, onStatusChange }: IntegrationCardProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isConnected = integration.status === 'CONNECTED'
  const isWaiting = integration.status === 'WAITING_QR'

  const handleConnect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await connectWhatsapp(integration.id)
      if (data.status === 'CONNECTED') {
        setQrCode(null)
        toast.success(t('connected') || 'WhatsApp connected!')
        onStatusChange()
      } else if (data.base64) {
        setQrCode(
          data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`,
        )
        onStatusChange()
      } else if (data.error) {
        setError(data.error)
      } else {
        setError('QR code not ready. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [integration.id, onStatusChange, t])

  const connectRef = useRef(handleConnect)
  connectRef.current = handleConnect

  const shouldAutoConnect =
    (integration.status === 'DISCONNECTED' || isWaiting) && !qrCode && !error && !loading

  useEffect(() => {
    if (shouldAutoConnect) connectRef.current()
  }, [shouldAutoConnect])

  useEffect(() => {
    if (isWaiting && qrCode) {
      pollRef.current = setInterval(() => onStatusChange(), 10000)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [isWaiting, qrCode, onStatusChange])

  useEffect(() => {
    if (isConnected) {
      setQrCode(null)
      setError(null)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isConnected])

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await disconnectWhatsapp(integration.id)
      setQrCode(null)
      toast.success('WhatsApp disconnected')
      onStatusChange()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteIntegration(integration.id)
      toast.success('Integration removed')
      onStatusChange()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove')
    }
  }

  const handleRefreshQr = () => {
    setQrCode(null)
    setError(null)
    handleConnect()
  }

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
            isConnected
              ? 'bg-green-500/10 text-green-600 border-green-500/20'
              : isWaiting
                ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                : 'bg-muted text-muted-foreground border-border',
          )}
        >
          {isConnected
            ? t('connected') || 'Connected'
            : isWaiting
              ? t('waiting_qr') || 'Waiting QR'
              : t('disconnected') || 'Disconnected'}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-8">
        {error && (
          <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshQr}
              className="ml-auto shrink-0 text-destructive"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        )}
        {qrCode && isWaiting && (
          <div className="flex flex-col items-center justify-center p-8 border border-border/60 rounded-3xl bg-muted/20 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56" />
            </div>
            <h4 className="font-semibold text-foreground mb-1">
              {t('scan_to_connect') || 'Scan to connect'}
            </h4>
            <p className="text-sm font-medium text-muted-foreground text-center max-w-[250px]">
              {t('scan_desc') || 'Open WhatsApp → Settings → Linked Devices'}
            </p>
          </div>
        )}
        {loading && !qrCode && !error && (
          <div className="flex items-center justify-center p-8 min-h-[120px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 border-t border-border/40 py-5 px-8 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <div className="text-sm font-medium text-muted-foreground text-center sm:text-left">
          {isConnected
            ? t('actively_connected') || 'Actively connected'
            : 'Configure this instance'}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isWaiting && qrCode && (
            <Button
              variant="outline"
              onClick={handleRefreshQr}
              disabled={loading}
              className="rounded-full px-6 h-11 font-semibold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh_qr') || 'Refresh QR'}
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
