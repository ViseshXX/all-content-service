/**
 * Inline preview components for audio and image URLs used in the content edit form.
 * Bare filenames are expanded to the correct S3 path based on the audio type.
 * Elements that fail to load are hidden via onError so no broken UI is shown.
 */

import * as React from 'react'
import { Search, Volume2, Square } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export const S3_BASE_URL = 'https://all-dev-content-service.s3.ap-south-1.amazonaws.com'

interface AudioPreviewProps {
  url?: string
  /**
   * 'content'       → all-audio-files/{language}/{file}   (contentSourceData)
   * 'mechanics'     → mechanics_audios/{file}
   * 'multilingual'  → multilingual_audios/{file}
   */
  audioType?: 'content' | 'mechanics' | 'multilingual'
  /** Required when audioType === 'content' */
  language?: string
}

function resolveAudioUrl(url: string, audioType: AudioPreviewProps['audioType'], language?: string): string {
  const s = url.trim()
  if (!s) return ''
  if (s.startsWith('http')) return s

  const file = s.replace(/^\//, '')
  if (audioType === 'content') {
    return `${S3_BASE_URL}/all-audio-files/${language ?? 'en'}/${file}`
  }
  if (audioType === 'multilingual') {
    return `${S3_BASE_URL}/multilingual_audios/${file}`
  }
  // default: mechanics
  return `${S3_BASE_URL}/mechanics_audios/${file}`
}

export function AudioPreview({ url, audioType = 'mechanics', language }: AudioPreviewProps) {
  const [errored, setErrored] = React.useState(false)
  const src = url?.trim() ? resolveAudioUrl(url.trim(), audioType, language) : ''

  React.useEffect(() => { setErrored(false) }, [src])

  if (!src || errored) return null
  return (
    <audio
      controls
      src={src}
      className="h-8 w-full mt-1"
      onError={() => setErrored(true)}
    />
  )
}

/**
 * Shared purple audio play/stop button used in all mechanic previews.
 * Purple circle with a speaker icon (idle) or stop square (playing).
 */
export function PlayAudioButton({
  playing,
  onClick,
  size = 44,
  disabled = false,
}: {
  playing: boolean
  onClick: () => void
  size?: number
  disabled?: boolean
}) {
  const iconSize = Math.round(size * 0.44)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={playing ? 'Stop' : 'Play audio'}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: disabled ? '#D1D5DB' : '#7C3AED',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {playing
        ? <Square size={iconSize} color="white" fill="white" />
        : <Volume2 size={iconSize} color="white" />
      }
    </button>
  )
}

/**
 * Clickable image that opens a full-size lightbox dialog instead of a new tab.
 * Self-contained — owns its own open/close state.
 */
export function ClickableImage({ src, alt = 'preview', className, showMagnifyIcon = true }: { src: string; alt?: string; className?: string; showMagnifyIcon?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  React.useEffect(() => { setErrored(false) }, [src])

  if (errored) return null

  return (
    <>
      <div className="relative inline-block">
        <img
          src={src}
          alt={alt}
          className={`cursor-zoom-in ${className ?? ''}`}
          onClick={() => setOpen(true)}
          onError={() => setErrored(true)}
        />
        {showMagnifyIcon && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute top-1.5 left-1.5 bg-white/90 rounded-full p-1 shadow hover:bg-white transition-colors"
            title="View full size"
          >
            <Search className="h-3 w-3 text-gray-600" />
          </button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none [&>button]:text-white [&>button]:hover:text-white/70">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-[80vh] object-contain rounded-md"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ImagePreview({ url }: { url?: string }) {
  if (!url?.trim()) return null
  const s = url.trim()
  const src = s.startsWith('http')
    ? s
    : `${S3_BASE_URL}/mechanics_images/${s.replace(/^\//, '')}`
  return (
    <div className="mt-1">
      <ClickableImage
        src={src}
        alt="preview"
        className="h-20 rounded-md object-cover border"
      />
    </div>
  )
}
