import * as React from 'react'
import { Mic } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, PlayAudioButton } from './MediaPreview'
import type { Content } from '@/types'

function getFontFamily(lang: string): string {
  if (lang === 'te') return 'Sree Krushnadevaraya, Quicksand, sans-serif'
  if (lang === 'kn') return '"Baloo Tamma 2", Quicksand, sans-serif'
  return 'Quicksand, sans-serif'
}

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુજరાતી', ma: 'मराठी',
}

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

export function ReadAlongPreviewModal({ content, open, onClose }: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)

  React.useEffect(() => { setIsPlaying(false) }, [content?._id])

  const sourceEntry = content
    ? (content.contentSourceData.find((e) => e.language === content.language) ??
       content.contentSourceData[0])
    : undefined

  const lang     = sourceEntry?.language ?? content?.language ?? 'en'
  const text     = sourceEntry?.text ?? ''
  const rawAudio = sourceEntry?.audioUrl?.trim()
  const audioSrc = rawAudio
    ? rawAudio.startsWith('http') ? rawAudio
      : `${S3_BASE_URL}/all-audio-files/${lang}/${rawAudio}`
    : ''

  function toggleAudio() {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) { el.pause(); setIsPlaying(false) }
    else           { el.play();  setIsPlaying(true)  }
  }

  const textFontSize =
    content?.contentType === 'Word' || content?.contentType === 'Char' ? '4rem'
    : content?.contentType === 'Sentence' ? '2.75rem'
    : '2.25rem'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="border-none p-5 max-w-[90vw] w-[90vw] h-[85vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
        style={{ backgroundColor: '#5BC8F5' }}
      >
        <DialogTitle className="sr-only">Preview — {content?.name}</DialogTitle>

        {/* "Read Along" label + language pill */}
        <div className="flex items-center justify-between mb-4 pr-6">
          <p className="italic text-white/90 text-sm tracking-wide">Read Along</p>
          <span style={{
            background: '#22b8a0',
            color: 'white', fontSize: '13px', fontWeight: 700,
            padding: '4px 14px', borderRadius: '20px',
            fontFamily: 'Quicksand, sans-serif',
          }}>
            {LANG_LABELS[lang] ?? lang}
          </span>
        </div>

        {/* White card — flex-1 so it fills remaining height */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '60px',
          gap: '56px',
          flex: 1,
        }}>
          {/* Content text */}
          <p style={{
            fontFamily: getFontFamily(lang),
            fontSize: textFontSize,
            fontWeight: 600,
            color: '#1a2a4a',
            lineHeight: 1.2,
            margin: 0,
          }}>
            {text || '—'}
          </p>

          {/* Volume + Mic */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <PlayAudioButton
              size={68}
              playing={isPlaying}
              onClick={toggleAudio}
              disabled={!audioSrc}
            />
            <button
              type="button"
              title="Recording not available in preview"
              style={{
                width: 68, height: 68, borderRadius: '50%', border: 'none',
                cursor: 'default', backgroundColor: '#22C55E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(34,197,94,0.4)',
              }}
            >
              <Mic size={30} />
            </button>
          </div>
        </div>

        {audioSrc && (
          <audio ref={audioRef} src={audioSrc} onEnded={() => setIsPlaying(false)} className="hidden" />
        )}
      </DialogContent>
    </Dialog>
  )
}
