import { useState } from 'react'
import { useIntegration } from '@/hooks/use-integration'
import { useLanguage } from '@/hooks/use-language'
import { connectWhatsapp } from '@/services/integrations'
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
import { Loader2, MessageCircle, Plug, Unplug, Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Settings() {
  const { integrations, loading, addIntegration, refreshIntegrations } = useIntegration()
  const { t } = useLanguage()
  const [isAdding, setIsAdding] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)

  const handleAdd = async () => {
    setIsAdding(true)
    try {
      await addIntegration()
      toast.success('New WhatsApp instance created')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create instance')
    } finally {
      setIsAdding(false)
    }
  }

  const handleConnect = async (integrationId: string) => {
    setConnectingId(integrationId)
    setQrCode(null)
    let retries = 0
    const attempt = async () => {
      try {
        const data = await connectWhatsapp()
        if (data.status === 'CONNECTED') {
          toast.success(t('already_connected') || 'WhatsApp connected!')
          setQrCode(null)
          await refreshIntegrations()
          setConnectingId(null)
        } else if (data.base64) {
          setQrCode(data.base64)
          setConnectingId(null)
        } else if (retries < 5) {
          retries++
          setTimeout(attempt, 2000)
        } else {
          toast.error('QR not ready. Try again.')
          setConnectingId(null)
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to connect')
        setConnectingId(null)
      }
    }
    attempt()
  }

  const handleRefreshQr = async (integrationId: string) => {
    await handleConnect(integrationId)
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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t('settings') || 'Settings'}
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            {t('settings_desc') || 'Manage your WhatsApp connections'}
          </p>
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
          integrations.map((integ) => {
            const isConnected = integ.status === 'CONNECTED'
            const isWaiting = integ.status === 'WAITING_QR'
            const isBusy = connectingId === integ.id
            return (
              <Card
                key={integ.id}
                className="shadow-subtle border border-border/40 rounded-[2rem] bg-card overflow-hidden"
              >
                <CardHeader className="pb-6 pt-8 px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-3 text-xl tracking-tight">
                      <div className="bg-green-500/10 text-green-500 p-2.5 rounded-2xl">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      {integ.instance_name || 'WhatsApp Instance'}
                    </CardTitle>
                    <CardDescription className="font-medium text-sm text-muted-foreground max-w-sm">
                      {t('whatsapp_connection_desc') || 'Connect via QR Code'}
                    </CardDescription>
                  </div>
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
                    {isConnected
                      ? t('connected') || 'Connected'
                      : isWaiting
                        ? t('waiting_qr') || 'Waiting QR'
                        : t('disconnected') || 'Disconnected'}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 px-8">
                  {qrCode && isWaiting && connectingId !== integ.id && (
                    <div className="flex flex-col items-center justify-center p-8 border border-border/60 rounded-3xl bg-muted/20 animate-in fade-in zoom-in-95 duration-300">
                      <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                        <img
                          src={
                            qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`
                          }
                          alt="WhatsApp QR Code"
                          className="w-56 h-56"
                        />
                      </div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {t('scan_to_connect') || 'Scan to connect'}
                      </h4>
                      <p className="text-sm font-medium text-muted-foreground text-center max-w-[250px]">
                        {t('scan_desc') || 'Open WhatsApp → Settings → Linked Devices'}
                      </p>
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
                        type="button"
                        variant="outline"
                        onClick={() => handleRefreshQr(integ.id)}
                        disabled={isBusy}
                        className="rounded-full px-6 h-11 font-semibold"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {t('refresh_qr') || 'Refresh QR'}
                      </Button>
                    )}
                    {isConnected ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isBusy}
                        className="rounded-full px-6 h-11 font-semibold"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unplug className="mr-2 h-4 w-4" />
                        )}
                        {t('disconnect_instance') || 'Disconnect'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleConnect(integ.id)}
                        disabled={isBusy}
                        className="rounded-full px-6 h-11 font-semibold"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="mr-2 h-4 w-4" />
                        )}
                        {t('connect_whatsapp') || 'Connect WhatsApp'}
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
