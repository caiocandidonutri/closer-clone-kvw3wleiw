import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, UploadCloud, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BatchFileItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export interface BatchUploadProps {
  /** Accepted file types for the input accept attribute. */
  accept: string
  /** Translated labels. */
  labels: {
    selectFiles: string
    hint: string
    uploading: (done: number, total: number) => string
    success: string
    error: string
  }
  /** Create one record per file. Title defaults to the file name. */
  createOne: (file: File) => Promise<void>
  /** Called when the whole batch finishes (success or not). */
  onComplete?: () => void
  /** Optional className for the container. */
  className?: string
}

/**
 * Multi-file uploader: lets the user pick several files at once (input[multiple]),
 * shows per-file progress and success/error feedback, and calls `createOne` for each.
 */
export function BatchUpload({
  accept,
  labels,
  createOne,
  onComplete,
  className,
}: BatchUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchFileItem[]>([])
  const [running, setRunning] = useState(false)

  const reset = () => {
    setItems([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const handlePick = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const next: BatchFileItem[] = Array.from(files).map((file) => ({
      file,
      status: 'pending',
    }))
    setItems(next)
    void run(next)
  }

  const run = async (list: BatchFileItem[]) => {
    setRunning(true)
    let done = 0
    let failed = 0
    for (let i = 0; i < list.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)))
      try {
        await createOne(list[i].file)
        done += 1
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)))
      } catch (err: any) {
        failed += 1
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'error', error: err?.message || 'Falha no upload' } : it,
          ),
        )
      }
    }
    setRunning(false)
    onComplete?.()
    if (failed === 0 && done > 0) {
      // all succeeded — clear the list after a short beat
      setTimeout(reset, 1200)
    }
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const showProgress = items.length > 0

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          ref={inputRef}
          id="batch-upload-input"
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => handlePick(e.target.files)}
          disabled={running}
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={running}
          onClick={() => inputRef.current?.click()}
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          {labels.selectFiles}
        </Button>
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{labels.hint}</p>
      </div>

      {showProgress && (
        <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">
              {running ? labels.uploading(doneCount, items.length) : null}
            </span>
            <div className="flex gap-3">
              {doneCount > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {doneCount} {labels.success}
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> {errorCount} {labels.error}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-xl bg-card border border-border/40 px-3 py-2"
              >
                <div className="bg-primary/10 text-primary p-1.5 rounded-lg shrink-0">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {it.file.name}
                </span>
                {it.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                )}
                {it.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                )}
                {it.status === 'error' && (
                  <span className="flex items-center gap-1 text-[10px] text-destructive shrink-0">
                    <XCircle className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {!running && errorCount > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={reset}
              >
                Limpar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
