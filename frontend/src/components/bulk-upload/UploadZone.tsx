import * as React from 'react'
import { Upload, ArrowLeft, FileArchive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TemplateType } from '@/types'

const TEMPLATE_TYPES: TemplateType[] = [
  'M1 to M2 Read Along Content',
  'M3 Read Along Content',
  'M4 to M6 Read Along Content',
  'M7 to M9 Read Along Content',
  'Textbook image mechanic',
  'M1 Mechanics Content',
  'M2 Mechanics Content',
  'M3 Mechanics Content',
  'M4 to M6 Mechanics Content',
  'M7 to M9 Mechanics Content',
  'M10 to M15 Mechanics Content',
  'Collection',
  'Multilingual',
]

interface UploadZoneProps {
  file: File | null
  onFileChange: (file: File) => void
  onUpload: () => void
  onBack: () => void
  isUploading?: boolean
  templateType: TemplateType
  onTemplateTypeChange: (type: TemplateType) => void
}

export function UploadZone({
  file,
  onFileChange,
  onUpload,
  onBack,
  isUploading,
  templateType,
  onTemplateTypeChange,
}: UploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFileChange(dropped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) onFileChange(selected)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload ZIP Bundle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Template type confirmation ─────────────────────────────── */}
        <div className="space-y-1">
          <Label>Confirm Template Type *</Label>
          <Select value={templateType} onValueChange={(v) => onTemplateTypeChange(v as TemplateType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Ensure this matches the template you filled in. A mismatch will cause validation errors.
          </p>
        </div>

        {/* ── Drop zone ─────────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-10 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {file ? (
            <>
              <FileArchive className="h-10 w-10 text-primary" />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB — click or drop to replace
              </p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop a .zip bundle here, or click to browse
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Edit Config
          </Button>
          <Button
            type="button"
            disabled={!file || isUploading}
            onClick={onUpload}
          >
            {isUploading ? 'Uploading...' : 'Upload to Backend'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
