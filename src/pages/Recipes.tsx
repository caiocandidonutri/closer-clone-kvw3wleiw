import { useState } from 'react'
import { useRecipes } from '@/hooks/use-recipes'
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
import { Plus, Trash2, Edit2, Loader2, ChefHat, Paperclip, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import type { Recipe } from '@/lib/types'
import { recipeFileUrl } from '@/services/recipes'
import { BatchUpload } from '@/components/settings/BatchUpload'

const ACCEPTED = 'application/pdf,image/*,.doc,.docx,.txt'

const FILE_EXT_BADGE = (file?: string) => {
  if (!file) return null
  const ext = file.split('.').pop()?.toUpperCase()
  return ext || 'PDF'
}

interface FormState {
  title: string
  description: string
  content_text: string
  is_active: boolean
  file: File | null
}

const EMPTY: FormState = {
  title: '',
  description: '',
  content_text: '',
  is_active: true,
  file: null,
}

export default function Recipes() {
  const { recipes, loading, create, update, remove } = useRecipes()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (m: Recipe) => {
    setEditing(m)
    setForm({
      title: m.title || '',
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
        description: form.description,
        content_text: form.content_text,
        is_active: form.is_active,
        file: form.file,
      }
      if (editing) {
        await update(editing.id, payload)
      } else {
        await create(payload)
        toast.success('Receita adicionada com sucesso')
      }
      setOpen(false)
    } catch (_) {
      // error toast handled in hook
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <span className="bg-primary/10 text-primary p-2 rounded-xl">
              <ChefHat className="h-6 w-6" />
            </span>
            {t('recipes_title')}
          </h2>
          <p className="text-muted-foreground mt-1 font-medium max-w-xl">{t('recipes_desc')}</p>
        </div>
        <Button onClick={openCreate} className="rounded-full px-6 shadow-elevation shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t('recipes_add')}
        </Button>
      </div>

      <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-tight">
                  {t('recipes_upload_multiple')}
                </CardTitle>
                <CardDescription className="mt-1">{t('recipes_batch_title_hint')}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <BatchUpload
            accept={ACCEPTED}
            createOne={async (file) => {
              await create({ title: file.name.replace(/\.[^.]+$/, ''), file })
            }}
            labels={{
              selectFiles: t('recipes_select_files'),
              hint: t('recipes_drop_hint'),
              uploading: (done, total) => t('recipe_upload_progress', { done, total }),
              success: t('batch_file_success'),
              error: t('batch_file_error'),
            }}
          />
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl tracking-tight">{t('recipes_title')}</CardTitle>
              <CardDescription className="mt-1">{t('recipes_desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChefHat className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-bold text-foreground">{t('recipes_empty')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {t('recipes_empty_desc')}
              </p>
              <Button onClick={openCreate} variant="outline" className="rounded-full mt-5">
                <Plus className="mr-2 h-4 w-4" />
                {t('recipes_add')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recipes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:shadow-subtle transition-all"
                >
                  <div className="bg-primary/10 text-primary p-2.5 rounded-xl shrink-0">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground truncate">{m.title}</h4>
                      {m.file && (
                        <a
                          href={recipeFileUrl(m)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-primary/20"
                        >
                          <Paperclip className="h-3 w-3" /> {FILE_EXT_BADGE(m.file)}
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
                    <p className="text-[11px] text-muted-foreground/70 mt-2">
                      {t('recipe_uploaded_at')}: {new Date(m.created).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={m.is_active ?? false}
                      onCheckedChange={() => update(m.id, { is_active: !m.is_active })}
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
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-[2rem] p-0 overflow-hidden border-border/60">
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 md:p-8 pb-4 border-b border-border/40 bg-muted/20">
              <DialogTitle>{editing ? t('recipes_edit') : t('recipes_add')}</DialogTitle>
              <DialogDescription>{t('recipes_desc')}</DialogDescription>
            </DialogHeader>
            <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="r_title" className="font-semibold">
                  {t('recipe_title')}
                </Label>
                <Input
                  id="r_title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r_desc" className="font-semibold">
                  {t('recipe_description')}
                </Label>
                <Input
                  id="r_desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r_content" className="font-semibold">
                  {t('recipe_content')}
                </Label>
                <Textarea
                  id="r_content"
                  value={form.content_text}
                  onChange={(e) => setForm({ ...form, content_text: e.target.value })}
                  className="rounded-xl min-h-[140px] resize-none font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('recipe_content_help')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r_file" className="font-semibold">
                  {t('recipe_file')}
                </Label>
                <Input
                  id="r_file"
                  type="file"
                  accept={ACCEPTED}
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground font-medium">
                  {t('recipe_file_help')}
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/60">
                <Label className="font-semibold">{t('recipe_active')}</Label>
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
                {t('recipe_save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
