import { useState, useEffect } from 'react'
import { useIntegration, UserIntegration } from '@/hooks/use-integration'
import { useLanguage } from '@/hooks/use-language'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, MessageCircle, Plug, Unplug, CheckCircle2, Plus } from 'lucide-react'

function InstanceCard({
  integration,
  onRefresh,
}: {
  integration: UserIntegration
  onRefresh: () => void
}) {
  const { t } = useLanguage()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const isConnected = integration.status === 'CONNECTED'
  const isWaiting = integration.status === 'WAITING_QR'

  useEffect(() => {
    if (isConnected) setQrCode(null)
  }, [isConnected])

  const handleConnect = async () => {
    setIsConnecting(true)
    setQrCode(null)

    let retries = 0
    const fetchQr = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('evolution-get-qr', {
          body: { integrationId: integration.id },
        })

        if (error) throw error

        if (data?.base64) {
          setQrCode(data.base64)
          setIsConnecting(false)
          onRefresh()
        } else if (data?.connected) {
          toast.success(t('already_connected'))
          setIsConnecting(false)
          onRefresh()
        } else if ((data?.error === 'qr_not_ready_yet' || data?.creating) && retries < 5) {
          retries++
          setTimeout(fetchQr, 2000)
        } else {
          toast.error(data?.error || t('failed_init'))
          setIsConnecting(false)
        }
      } catch (e: any) {
        toast.error(e.message || t('error_connect'))
        setIsConnecting(false)
      }
    }

    fetchQr()
  }

  const handleDisconnect = async () => {
    setIsConnecting(true)
    try {
      const { error } = await supabase.functions.invoke('evolution-disconnect', {
        body: { integrationId: integration.id },
      })
      if (error) throw error
      toast.success(t('disconnected_success'))
      setQrCode(null)
      onRefresh()
    } catch (e: any) {
      toast.error(e.message || t('error_disconnect'))
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Card className="shadow-subtle border border-border/40 rounded-[2rem] bg-card overflow-hidden">
      <CardHeader className="pb-6 pt-8 px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-3 text-xl tracking-tight">
            <div className="bg-green-500/10 text-green-500 p-2.5 rounded-2xl">
              <MessageCircle className="h-5 w-5" />
            </div>
            {integration.instance_name || 'New WhatsApp Instance'}
          </CardTitle>
          <CardDescription className="font-medium text-sm text-muted-foreground max-w-sm">
            {t('whatsapp_connection_desc')}
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div
            className={cn(
              'self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap',
              isConnected
                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : isWaiting
                  ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                  : 'bg-muted text-muted-foreground border-border',
            )}
          >
            {isConnected ? t('connected') : isWaiting ? t('waiting_qr') : t('disconnected')}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-8">
        {qrCode && isWaiting && (
          <div className="flex flex-col items-center justify-center p-8 border border-border/60 rounded-3xl bg-muted/20 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 relative">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                className="w-56 h-56"
              />
              {isConnecting && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-2xl backdrop-blur-[1px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>
            <h4 className="font-semibold text-foreground mb-1">{t('scan_to_connect')}</h4>
            <p className="text-sm font-medium text-muted-foreground text-center max-w-[250px]">
              {t('scan_desc')}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 border-t border-border/40 py-5 px-8 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <div className="text-sm font-medium text-muted-foreground text-center sm:text-left">
          {isConnected ? t('actively_connected') : t('configure_instance')}
        </div>
        <div className="w-full sm:w-auto">
          {isConnected ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isConnecting}
              className="rounded-full px-6 h-11 w-full sm:w-auto font-semibold"
            >
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              {t('disconnect_instance')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="rounded-full px-6 h-11 w-full sm:w-auto font-semibold"
            >
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              {isWaiting && !qrCode
                ? t('generating')
                : isWaiting
                  ? t('refresh_qr')
                  : t('connect_whatsapp')}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

export default function Settings() {
  const { integrations, loading, addIntegration, refreshIntegrations } = useIntegration()
  const { t } = useLanguage()

  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    setIsAdding(true)
    await addIntegration()
    setIsAdding(false)
  }

  if (loading) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-apple min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('settings')}</h2>
          <p className="text-muted-foreground mt-1 font-medium">{t('settings_desc')}</p>
        </div>
        <Button
          onClick={handleAdd}
          disabled={isAdding}
          className="rounded-full px-6 shadow-elevation"
        >
          {isAdding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Connect New Number
        </Button>
      </div>

      <div className="space-y-6">
        {integrations.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-[2rem] border border-border shadow-subtle">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground">No WhatsApp Numbers Connected</h3>
            <p className="text-muted-foreground mt-1">
              Click the button above to link your first number.
            </p>
          </div>
        ) : (
          integrations.map((integ) => (
            <InstanceCard key={integ.id} integration={integ} onRefresh={refreshIntegrations} />
          ))
        )}
      </div>
    </div>
  )
}
