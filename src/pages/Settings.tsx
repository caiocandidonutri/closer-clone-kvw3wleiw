import { useState } from 'react'
import { useIntegration } from '@/hooks/use-integration'
import { useLanguage } from '@/hooks/use-language'
import { IntegrationCard } from '@/components/settings/IntegrationCard'
import { YasaAgentConfig } from '@/components/settings/YasaAgentConfig'
import { MaterialsManager } from '@/components/settings/MaterialsManager'
import { TemplatesManager } from '@/components/settings/TemplatesManager'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MessageCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function Settings() {
  const { integrations, loading, addIntegration, refreshIntegrations } = useIntegration()
  const { t } = useLanguage()
  const [isAdding, setIsAdding] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const handleAdd = async () => {
    setIsAdding(true)
    try {
      await addIntegration(newName || 'WhatsApp')
      toast.success('Nova instância do WhatsApp criada')
      setDialogOpen(false)
      setNewName('')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao criar instância')
    } finally {
      setIsAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t('settings') || 'Settings'}
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            {t('settings_desc') || 'Manage your WhatsApp connections'}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-full px-6 shadow-elevation">
          <Plus className="mr-2 h-4 w-4" />
          Conectar novo número
        </Button>
      </div>

      <div className="space-y-6">
        {integrations.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-[2rem] border border-border shadow-subtle">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground">
              Nenhum número do WhatsApp conectado
            </h3>
            <p className="text-muted-foreground mt-1">
              Clique no botão acima para vincular seu primeiro número.
            </p>
          </div>
        ) : (
          integrations.map((integ) => (
            <IntegrationCard
              key={integ.id}
              integration={integ}
              onStatusChange={refreshIntegrations}
            />
          ))
        )}
      </div>

      {/* Yasa AI Agent Configuration */}
      <YasaAgentConfig />

      {/* Materials / PDFs */}
      <MaterialsManager />

      {/* Meal Plan Templates */}
      <TemplatesManager />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar número do WhatsApp</DialogTitle>
            <DialogDescription>
              Digite um nome para identificar este número do WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="name">Nome da instância</Label>
            <Input
              id="name"
              placeholder="ex: Vendas, Suporte, Pessoal"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isAdding}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
