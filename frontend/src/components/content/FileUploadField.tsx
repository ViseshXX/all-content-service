import * as React from 'react'
import { Upload, X, FileAudio, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface FileUploadFieldProps {
  label: string
  accept: 'audio/*' | 'image/*'
  value: File | null
  onChange: (file: File | null) => void
  required?: boolean
  hint?: string
}

export function FileUploadField({
  label,
  accept,
  value,
  onChange,
  required,
  hint,
}: FileUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!value) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(value)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onChange(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onChange(file)
    // reset input so the same file can be re-selected after clear
    e.target.value = ''
  }

  const isAudio = accept === 'audio/*'

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {value ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isAudio
                ? <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                : <Image className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="text-sm truncate">{value.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                ({(value.size / 1024).toFixed(0)} KB)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {previewUrl && isAudio && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={previewUrl} className="w-full h-8" />
          )}
          {previewUrl && !isAudio && (
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-32 rounded object-contain"
            />
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">
            Drag & drop or click to browse
          </p>
          {hint && (
            <p className="text-xs text-muted-foreground/70 text-center">{hint}</p>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
