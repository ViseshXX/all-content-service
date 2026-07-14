/**
 * AssetUploadField — drag-and-drop upload for audio or image assets in edit mode.
 *
 * Deferred uploads: selecting a file shows a local blob-URL preview immediately.
 * The actual S3 upload happens when the form's save handler calls flushPendingUploads().
 * TTS generation still uploads immediately (no local preview possible for server-side synthesis).
 *
 * Behaviour:
 * - Shows filename as an editable text input (unless readonly=true)
 * - S3 existence is checked 600ms after the user stops typing (skipped while file is staged)
 * - When the user changes the filename from its original saved value (isEdited):
 *     • Audio only: shows "Generate TTS" + upload zone side-by-side
 *     • Both options remain available so the curator can generate TTS, listen,
 *       dislike it, and then upload their own file
 * - After a successful TTS generation the audio preview is force-refreshed (key={refreshNonce})
 * - After a staged file is flushed on save, the preview refreshes to show S3 audio/image
 * - readonly=true: filename cannot be typed — only replaced via upload
 *   (used for read-along contentSourceData audio where name = contentId.wav)
 */

import * as React from 'react'
import { Upload, Loader2, CheckCircle2, AlertTriangle, Sparkles, Clock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { uploadContentAsset, checkAssetExists, generateTts } from '@/api/content'
import { AudioPreview, ClickableImage, S3_BASE_URL } from './MediaPreview'

// ─── Module-level pending registries ─────────────────────────────────────────

// Fields whose filename was changed but no file selected / TTS generated → blocks save
const _pendingAssetFields = new Set<string>()
export function hasPendingAssetChanges(): boolean { return _pendingAssetFields.size > 0 }

// Fields with a staged file (selected locally but not yet uploaded to S3)
interface PendingUpload {
  upload: () => Promise<string>          // resolves to S3 filename
  onChange: (filename: string) => void   // updates RHF form value
  cleanup: () => void                    // revokes blob URL, clears local preview
}
const _pendingFiles = new Map<string, PendingUpload>()
export function hasPendingUploads(): boolean { return _pendingFiles.size > 0 }

/**
 * Upload all staged files to S3 in sequence.
 * Calls onChange with the resulting S3 filename so the RHF form is updated.
 * Throws on first failure (after cleaning up that entry).
 */
export async function flushPendingUploads(): Promise<void> {
  const entries = Array.from(_pendingFiles.entries())
  for (const [key, pending] of entries) {
    let filename: string
    try {
      filename = await pending.upload()
    } catch (err) {
      pending.cleanup()
      _pendingFiles.delete(key)
      throw err
    }
    pending.onChange(filename)
    pending.cleanup()
    _pendingFiles.delete(key)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssetUploadFieldProps {
  assetType: 'audio' | 'image'
  value?: string
  onChange: (filename: string) => void
  language?: string
  audioType?: 'content' | 'mechanics' | 'multilingual'
  audioFolder?: string
  contentId?: string
  /** Source text for TTS generation (shown when isEdited && assetType === 'audio') */
  sourceText?: string
  /** When true the filename input is read-only; upload zone still works */
  readonly?: boolean
  disabled?: boolean
  /** RHF field name — used to register this field in the pending-changes registry */
  fieldName?: string
}

type S3Status = 'idle' | 'checking' | 'found' | 'missing'

function deriveS3Prefix(
  assetType: 'audio' | 'image',
  audioType: 'content' | 'mechanics' | 'multilingual',
  audioFolder: string | undefined,
  language: string | undefined,
): string {
  if (assetType === 'image') return 'mechanics_images'
  if (audioFolder) return audioFolder
  if (audioType === 'multilingual') return 'multilingual_audios'
  if (audioType === 'mechanics') return 'mechanics_audios'
  return `all-audio-files/${language ?? 'en'}`
}

function stripFolder(v: string) {
  return v.trim().replace(/^.*\//, '')
}

export function AssetUploadField({
  assetType,
  value,
  onChange,
  language,
  audioType = 'content',
  audioFolder,
  contentId,
  sourceText,
  readonly = false,
  disabled,
  fieldName,
}: AssetUploadFieldProps) {
  const initBare = stripFolder(value ?? '')

  // Local editable value — responsive while debounce / TTS runs
  const [localValue, setLocalValue] = React.useState(initBare)

  // The last value that was persisted to S3 (set on mount; updated after TTS or flush)
  const originalValueRef = React.useRef(initBare)

  // Always-current localValue — read by deferred upload thunk at flush time
  const localValueRef = React.useRef(initBare)

  // Blob URL for the currently staged file (null when no file is staged)
  const blobUrlRef = React.useRef<string | null>(null)

  // Saved originalValueRef from before a file was staged — restored on undo
  const preStageOriginalRef = React.useRef<string>('')

  const [generatingTts,   setGeneratingTts]   = React.useState(false)
  const [s3Status,        setS3Status]        = React.useState<S3Status>('idle')
  const [dragging,        setDragging]        = React.useState(false)
  // Increment after TTS or flush to force AudioPreview remount (cache-bust S3 URL)
  const [refreshNonce,    setRefreshNonce]    = React.useState(0)
  // Blob URL shown as an immediate local preview before the file is uploaded to S3
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Keep localValueRef in sync so deferred upload thunk always uses the latest filename
  React.useEffect(() => { localValueRef.current = localValue }, [localValue])

  // Sync localValue when prop changes from outside (e.g. form reset after save)
  React.useEffect(() => {
    setLocalValue(stripFolder(value ?? ''))
  }, [value])

  // isEdited: curator typed a different filename from the saved value — no file staged yet.
  // originalValueRef.current !== '' ensures create pages (original = '') are never blocked.
  const isEdited = assetType === 'audio' && !readonly
    && localValue.trim() !== ''
    && originalValueRef.current !== ''
    && localValue.trim() !== originalValueRef.current

  // isEditedImage: same concept for images
  const isEditedImage = assetType === 'image' && !readonly
    && localValue.trim() !== ''
    && originalValueRef.current !== ''
    && localValue.trim() !== originalValueRef.current

  // A file has been selected locally and is waiting to be uploaded on save
  const isStaged = localPreviewUrl !== null

  // Register / deregister in the blocking-pending set
  React.useEffect(() => {
    if (!fieldName) return
    const isPending = isEdited || isEditedImage
    if (isPending) _pendingAssetFields.add(fieldName)
    else           _pendingAssetFields.delete(fieldName)
    return () => { _pendingAssetFields.delete(fieldName) }
  }, [isEdited, isEditedImage, fieldName])

  // Cleanup on unmount — revoke blob URL and deregister pending entries
  React.useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (fieldName) {
        _pendingFiles.delete(fieldName)
        _pendingAssetFields.delete(fieldName)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced S3 check — skip while file is staged locally (not on S3 yet)
  React.useEffect(() => {
    if (!localValue.trim() || isStaged) { setS3Status('idle'); return }
    setS3Status('checking')
    const timer = setTimeout(() => {
      const prefix = deriveS3Prefix(assetType, audioType, audioFolder, language)
      const key    = `${prefix}/${localValue.trim()}`
      let cancelled = false
      checkAssetExists(key)
        .then((exists) => { if (!cancelled) setS3Status(exists ? 'found' : 'missing') })
        .catch(()      => { if (!cancelled) setS3Status('idle') })
      return () => { cancelled = true }
    }, 600)
    return () => clearTimeout(timer)
  }, [localValue, assetType, audioType, audioFolder, language, isStaged]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilenameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setLocalValue(v)
    onChange(v.trim())
    // Clear any staged file — filename changed, the staged file is now for the wrong name
    if (fieldName && _pendingFiles.has(fieldName)) {
      const pending = _pendingFiles.get(fieldName)!
      pending.cleanup()
      _pendingFiles.delete(fieldName)
      preStageOriginalRef.current = ''
    }
  }

  function handleUndoStage() {
    // Restore originalValueRef to what it was before the file was staged
    originalValueRef.current = preStageOriginalRef.current
    preStageOriginalRef.current = ''
    // Revoke blob URL and clear the staged preview
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setLocalPreviewUrl(null)
    if (fieldName) _pendingFiles.delete(fieldName)
  }

  const accept = assetType === 'audio'
    ? 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac'
    : 'image/*,.jpg,.jpeg,.png,.webp,.gif'

  function handleFile(file: File) {
    if (disabled) return

    // Revoke any previous blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    // Create a local blob URL for immediate preview (no S3 upload yet)
    const blobUrl = URL.createObjectURL(file)
    blobUrlRef.current = blobUrl
    setLocalPreviewUrl(blobUrl)

    // Save the pre-stage original so "undo" can restore it
    preStageOriginalRef.current = originalValueRef.current
    // Treat the current filename as "committed" so isEdited resets
    originalValueRef.current = localValue.trim()

    if (fieldName) {
      // Register the deferred upload thunk
      const capturedOnChange = onChange
      _pendingFiles.set(fieldName, {
        upload: async () => {
          const filename = localValueRef.current.trim() || undefined
          return await uploadContentAsset(assetType, file, language, filename, audioFolder)
        },
        onChange: capturedOnChange,
        cleanup: () => {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
            blobUrlRef.current = null
          }
          setLocalPreviewUrl(null)
          setRefreshNonce((n) => n + 1)
        },
      })
      toast({ title: 'File staged', description: 'Will be uploaded when you save.' })
    } else {
      // No fieldName: upload immediately (safety fallback — all call sites pass fieldName)
      uploadContentAsset(assetType, file, language, localValue.trim() || undefined, audioFolder)
        .then((filename) => {
          originalValueRef.current = filename
          onChange(filename)
          if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
          setLocalPreviewUrl(null)
          setRefreshNonce((n) => n + 1)
          toast({ title: 'Upload successful', description: filename })
        })
        .catch((err: any) => {
          if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
          setLocalPreviewUrl(null)
          toast({ title: 'Upload failed', description: err?.response?.data?.message ?? err?.message ?? 'Unknown error', variant: 'destructive' })
        })
    }
  }

  async function handleGenerateTts() {
    if (!sourceText?.trim() || !language?.trim()) {
      toast({ title: 'Cannot generate TTS', description: 'Source text and language are required.', variant: 'destructive' })
      return
    }
    const folder   = deriveS3Prefix(assetType, audioType, audioFolder, language)
    const filename = localValue.trim()
    setGeneratingTts(true)
    try {
      const result = await generateTts(sourceText.trim(), language.trim(), filename, folder)
      originalValueRef.current = result
      onChange(result)
      setRefreshNonce((n) => n + 1)
      toast({ title: 'Audio generated', description: result })
    } catch (err: any) {
      toast({ title: 'TTS generation failed', description: err?.response?.data?.message ?? err?.message ?? 'Unknown error', variant: 'destructive' })
    } finally {
      setGeneratingTts(false)
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function onDragLeave() { setDragging(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const s3ImagePreviewUrl = assetType === 'image' && localValue.trim()
    ? `${S3_BASE_URL}/mechanics_images/${localValue.trim()}`
    : undefined

  const isMissing = s3Status === 'missing' && !isEdited && !isEditedImage && !isStaged

  return (
    <div className="space-y-2">
      {/* Filename row */}
      <div className={`flex items-center gap-2 h-9 w-full rounded-md border px-3 py-1 text-sm overflow-hidden ${
        isMissing ? 'border-destructive bg-destructive/5' : 'border-input bg-muted'
      }`}>
        <input
          type="text"
          value={localValue}
          onChange={handleFilenameChange}
          readOnly={readonly}
          disabled={disabled}
          placeholder={readonly ? (contentId ? `${contentId}.wav` : 'No file') : 'No file'}
          className={`flex-1 min-w-0 bg-transparent outline-none font-mono text-sm
            placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-sans
            ${isMissing ? 'text-destructive' : 'text-muted-foreground'}
            ${readonly ? 'cursor-default select-all' : ''}`}
        />
        {isStaged && (
          <span title="File staged — will upload on save">
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          </span>
        )}
        {!isStaged && s3Status === 'checking' && !isEdited && !isEditedImage && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
        {!isStaged && s3Status === 'found' && !isEdited && !isEditedImage && (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        )}
        {isMissing && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
      </div>

      {/* Missing asset error (only when NOT in edited/staged state) */}
      {isMissing && (
        <p className="text-xs text-destructive">
          {assetType === 'image'
            ? 'Image not found in S3 — please upload a replacement.'
            : 'Audio not found in S3 — please upload a replacement.'}
        </p>
      )}

      {/* Staged file notice with undo */}
      {isStaged && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-700 font-medium">
            File staged — will be uploaded when you save.
          </p>
          <button
            type="button"
            onClick={handleUndoStage}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Undo
          </button>
        </div>
      )}

      {/* Edited-name action panel — TTS + upload, always both available */}
      {isEdited && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-xs text-amber-800 font-medium">
            New filename — generate TTS audio or upload your own file for <span className="font-mono">{localValue.trim()}</span>
          </p>
          <button
            type="button"
            disabled={generatingTts || disabled || !sourceText?.trim()}
            onClick={handleGenerateTts}
            title={!sourceText?.trim() ? 'Fill in the text field first to generate TTS' : 'Generate TTS audio'}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingTts
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3 w-3" /> Generate TTS</>}
          </button>
        </div>
      )}

      {/* Image edited-name panel */}
      {isEditedImage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs text-amber-800 font-medium">
            New filename — upload an image file for <span className="font-mono">{localValue.trim()}</span>
          </p>
        </div>
      )}

      {/* Audio preview — blob URL shown immediately when file is staged */}
      {assetType === 'audio' && (
        localPreviewUrl
          ? <audio controls src={localPreviewUrl} className="h-8 w-full mt-1" />
          : <AudioPreview
              key={refreshNonce}
              url={localValue.trim() || (contentId ? `${contentId}.wav` : undefined)}
              audioType={audioType}
              language={language}
            />
      )}

      {/* Image preview — blob URL shown immediately when file is staged */}
      {assetType === 'image' && (
        localPreviewUrl
          ? <img src={localPreviewUrl} alt="preview" className="h-20 rounded-md object-cover border mt-1" />
          : s3ImagePreviewUrl && (
              <ClickableImage
                src={s3ImagePreviewUrl}
                alt="preview"
                className="h-20 rounded-md object-cover border mt-1"
              />
            )
      )}

      {/* Upload drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors cursor-pointer select-none
          ${isMissing ? 'border-destructive/50' : ''}
          ${isEdited || isEditedImage || isStaged ? 'border-amber-400 text-amber-700' : ''}
          ${dragging  ? 'border-primary bg-primary/5 text-primary' : 'hover:border-muted-foreground/50'}
          ${disabled  ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5 shrink-0" />
        <span>
          {dragging                          ? 'Drop to upload'
          : isStaged                         ? `Replace staged ${assetType}`
          : isEdited || isEditedImage        ? `Upload file for "${localValue.trim()}"`
          : localValue.trim()                ? `Drop or click to replace ${assetType}`
          : `Drop or click to upload ${assetType}`}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileInputChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
