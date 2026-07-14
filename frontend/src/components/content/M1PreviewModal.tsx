import * as React from 'react'
import { Mic } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, ClickableImage, PlayAudioButton } from './MediaPreview'
import type { Content } from '@/types'

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુજરાતી', ma: 'मराठी',
}

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

function resolveAudioUrl(raw: string | undefined): string {
  if (!raw) return ''
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return `${S3_BASE_URL}/mechanics_audios/${raw}`
}

function resolveImageUrl(raw: string | undefined): string {
  if (!raw) return ''
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return `${S3_BASE_URL}/mechanics_images/${raw}`
}

export function M1PreviewModal({ content, open, onClose }: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = React.useState(false)

  React.useEffect(() => { setPlaying(false) }, [content?._id])

  function toggleAudio() {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      setPlaying(false)
    } else {
      el.play()
      setPlaying(true)
    }
  }

  const lang       = content?.language ?? 'en'
  const sourceData = content?.contentSourceData?.[0]
  const wordText   = sourceData?.text ?? ''
  const audioUrl   = resolveAudioUrl(sourceData?.audioUrl)
  const m1Mechanic = content?.mechanics_data?.find((m) => m.mechanics_id === 'M1_L')
  const imageUrl   = resolveImageUrl(m1Mechanic?.image_url)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="border-none p-5 max-w-[90vw] w-[90vw] h-[80vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
        style={{ backgroundColor: '#1D4ED8' }}
      >
        <DialogTitle className="sr-only">M1 Preview — {content?.name}</DialogTitle>

        {/* Header bar */}
        <div className="flex items-center justify-between mb-4 pr-6">
          <p className="italic text-white/90 text-sm tracking-wide">M1</p>
          <span style={{
            background: '#1E40AF',
            color: 'white', fontSize: '13px', fontWeight: 700,
            padding: '4px 14px', borderRadius: '20px',
            fontFamily: 'Quicksand, sans-serif',
          }}>
            {LANG_LABELS[lang] ?? lang}
          </span>
        </div>

        {/* White card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'row',
          padding: '32px',
          gap: '0',
          flex: 1,
          overflow: 'hidden',
        }}>
          {/* ── Left column: word text + image ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flex: '0 0 auto',
            minWidth: '220px',
          }}>
            <span style={{
              fontFamily: 'Quicksand, sans-serif',
              fontWeight: 800,
              fontSize: '36px',
              color: '#262649',
              textAlign: 'center',
            }}>
              {wordText || <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '18px' }}>No text</span>}
            </span>

            {imageUrl ? (
              <ClickableImage
                src={imageUrl}
                alt="content"
                className="w-[200px] h-[200px] rounded-[15px] object-cover"
              />
            ) : (
              <div style={{
                width: '200px', height: '200px', borderRadius: '15px',
                background: '#f0f0f0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#aaa', fontSize: '13px',
              }}>
                No image
              </div>
            )}
          </div>

          {/* ── Vertical divider ── */}
          <div style={{ width: '1px', backgroundColor: '#E0E2E7', margin: '0 32px', alignSelf: 'stretch' }} />

          {/* ── Right column: text box + audio + mic ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            flex: 1,
          }}>
            {/* Word text in rounded box */}
            <div style={{
              background: '#EFF6FF',
              borderRadius: '16px',
              padding: '16px 32px',
              width: '100%',
              textAlign: 'center',
              fontFamily: 'Quicksand, sans-serif',
              fontWeight: 800,
              fontSize: '40px',
              color: '#262649',
            }}>
              {wordText}
            </div>

            {/* Audio play button */}
            {audioUrl ? (
              <>
                <PlayAudioButton size={52} playing={playing} onClick={toggleAudio} />
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="metadata"
                  onEnded={() => setPlaying(false)}
                  onPause={() => setPlaying(false)}
                />
              </>
            ) : (
              <PlayAudioButton size={52} playing={false} onClick={() => {}} disabled />
            )}

            {/* Placeholder record button */}
            <div
              title="Record (learner app only)"
              style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: '#86EFAC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'default', opacity: 0.85,
              }}
            >
              <Mic size={26} color="white" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
