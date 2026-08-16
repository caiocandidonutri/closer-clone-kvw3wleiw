import { useState } from 'react'
import { useMaterials } from '@/hooks/use-materials'
import { useLanguage } from '@/hooks/use-language'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, Edit2, Loader2, FileText, Paperclip } from 'lucide-react'
import type { AgentMaterial } from '@/lib/types'
import { materialFileUrl } from '@/services/yasa'

interface FormState {
  title: string
  topic: string
  description: string
  content_text: string
  is_active: boolean
  file: File | null
}

const EMPTY: FormState = {
  title: '',
  topic: '',
  description: '',
  content_text: '',
  is_active: true,
  file: null,
}

export function MaterialsManager() {
  const { materials, loading, create, update, remove, toggle } = useMaterials()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AgentMaterial | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (m: AgentMaterial) => {
    setEditing(m)
    setForm({
      title: m.title || '',
      topic: m.topic || '',
      description: m.description || '',
      content_text: m.content_text || '',
      is_active: m.is_active ?? true,
      file: null,
    })
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        topic: form.topic,
        description: form.description,
        content_text: form.content_text,
        is_active: form.is_active,
        file: form.file,
      }
      if (editing) {
        await update(editing.id, payload)
      } else {
        await create(payload)
      }
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl tracking-tight">{t('materials_title')}</CardTitle>
              <CardDescription className="mt-1">{t('materials_desc')}</CardDescription>
            </div>
          </div>
          <Button onClick={openCreate} className="rounded-full shadow-subtle shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t('materials_add')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 md:p-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">{t('materials_empty')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {t('materials_empty_desc')}
            </p>
            <Button onClick={openCreate} variant="outline" className="rounded-full mt-5">
              <Plus className="mr-2 h-4 w-4" />
              {t('materials_add')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:shadow-subtle transition-all"
              >
                <div className="bg-primary/10 text-primary p-2.5 rounded-xl shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-foreground truncate">{m.title}</h4>
                    {m.topic && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {m.topic}
                      </span>
                    )}
                    {m.file && (
                      <a
                        href={materialFileUrl(m)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-primary/20"
                      >
                        <Paperclip className="h-3 w-3" /> PDF
                      </a>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {m.description}
                    </p>
                  )}
                  {m.content_text && (
                    <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2 font-mono">
                      {m.content_text}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={m.is_active ?? false}
                    onCheckedChange={() => toggle(m.id, m.is_active ?? false)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-9 w-9"
                    onClick={() => openEdit(m)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-[2rem] p-0 overflow-hidden border-border/60">
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 md:p-8 pb-4 border-b border-border/40 bg-muted/20">
              <DialogTitle>{editing ? t('materials_edit') : t('materials_add')}</DialogTitle>
              <DialogDescription>{t('materials_desc')}</DialogDescription>
            </DialogHeader>
            <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="m_title" className="font-semibold">
                    {t('material_title')}
                  </Label>
                  <Input
                    id="m_title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m_topic" className="font-semibold">
                    {t('material_topic')}
                  </Label>
                  <Input
                    id="m_topic"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="ex: lanches, receitas, hidratação"
                    className="rounded-xl h-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m_desc" className="font-semibold">
                  {t('material_description')}
                </Label>
                <Input
                  id="m_desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m_content" className="font-semibold">
                  {t('material_content')}
                </Label>
                <Textarea
                  id="m_content"
                  value={form.content_text}
                  onChange={(e) => setForm({ ...form, content_text: e.target.value })}
                  className="rounded-xl min-h-[140px] resize-none font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('material_content_help')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m_file" className="font-semibold">
                  {t('material_pdf')}
                </Label>
                <Input
                  id="m_file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('material_pdf_help')}
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/60">
                <Label className="font-semibold">{t('material_active')}</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter className="p-6 md:p-8 pt-4 border-t border-border/40 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="rounded-full"
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full px-8 shadow-subtle">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('material_save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
