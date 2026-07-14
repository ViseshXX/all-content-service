import * as React from 'react'
import { ZoomIn, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, PlayAudioButton } from './MediaPreview'
import type { Content } from '@/types'

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુજรાતી', ma: 'मराठी',
}

function resolveUrl(raw: string | undefined, folder: string): string {
  if (!raw) return ''
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return `${S3_BASE_URL}/${folder}/${raw}`
}

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

export function M3PreviewModal({ content, open, onClose }: Props) {
  const mechanic  = content?.mechanics_data?.find((m) => m.mechanics_id === 'M3_L')
  const options   = mechanic?.options ?? []
  const lang      = content?.language ?? 'en'
  const source    = content?.contentSourceData?.[0]
  const text      = source?.text ?? ''
  const audioUrl  = (() => {
    const raw = source?.audioUrl
    if (!raw) return ''
    if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
    return `${S3_BASE_URL}/mechanics_audios/${raw}`
  })()

  const [answered,  setAnswered]  = React.useState(false)  // correct was selected
  const [wrongIdx,  setWrongIdx]  = React.useState<number | null>(null)
  const [zoomUrl,   setZoomUrl]   = React.useState<string | null>(null)
  const [playing,   setPlaying]   = React.useState(false)

  const audioRef   = React.useRef<HTMLAudioElement>(null)
  const wrongTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setAnswered(false)
    setWrongIdx(null)
    setPlaying(false)
    audioRef.current?.pause()
  }

  React.useEffect(() => { reset() }, [content?._id, open])  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
  }, [])

  function handleOptionClick(idx: number, isAns: boolean) {
    if (answered || wrongIdx !== null) return
    if (isAns) {
      setAnswered(true)
    } else {
      setWrongIdx(idx)
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      wrongTimer.current = setTimeout(() => setWrongIdx(null), 800)
    }
  }

  function toggleAudio() {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) { el.pause(); setPlaying(false) }
    else            { el.play();  setPlaying(true)  }
  }

  // Border/overlay style per card state
  function cardBorder(idx: number, isAns: boolean): React.CSSProperties {
    if (answered) {
      if (isAns) return { border: '3px solid #22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }
      return { border: '2px solid #E2E8F0', opacity: 0.45 }
    }
    if (wrongIdx === idx) return { border: '3px solid #EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.25)' }
    return { border: '2px solid #E2E8F0' }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="border-none p-5 max-w-[90vw] w-[90vw] h-[85vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
          style={{ backgroundColor: '#0F766E' }}
        >
          <DialogTitle className="sr-only">M3 Preview — {content?.name}</DialogTitle>

          {/* Header bar */}
          <div className="flex items-center justify-between mb-3 pr-6">
            <p className="italic text-white/90 text-sm tracking-wide">M3 — Sentence Image MCQ</p>
            <span style={{
              background: '#0D6B63', color: 'white', fontSize: '13px', fontWeight: 700,
              padding: '4px 14px', borderRadius: '20px', fontFamily: 'Quicksand, sans-serif',
            }}>
              {LANG_LABELS[lang] ?? lang}
            </span>
          </div>

          {/* White card */}
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '20px',
            padding: '28px', flex: 1,
            display: 'flex', flexDirection: 'column', gap: '24px', overflow: 'hidden',
          }}>
            {/* Sentence + audio */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              justifyContent: 'center', flexWrap: 'wrap',
            }}>
              <span style={{
                fontFamily: 'Quicksand, sans-serif', fontWeight: 800,
                fontSize: '28px', color: '#1E3A5F',
              }}>
                {text || <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '18px' }}>No text</span>}
              </span>
              <PlayAudioButton size={44} playing={playing} onClick={toggleAudio} disabled={!audioUrl} />
              {audioUrl && (
                <audio ref={audioRef} src={audioUrl} preload="metadata"
                  onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
              )}
            </div>

            {/* Image options */}
            {options.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, 1fr)`,
                gridAutoRows: '1fr',
                gap: '16px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}>
                {options.map((opt, idx) => {
                  const imgUrl = resolveUrl(opt.image_url, 'mechanics_images')
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOptionClick(idx, !!opt.isAns)}
                      style={{
                        position: 'relative', borderRadius: '14px',
                        overflow: 'hidden', cursor: answered || wrongIdx !== null ? 'default' : 'pointer',
                        transition: 'all 0.15s ease', backgroundColor: '#F1F5F9',
                        minHeight: 0,
                        ...cardBorder(idx, !!opt.isAns),
                      }}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={opt.text || `option ${idx + 1}`}
                          style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            objectFit: 'contain', display: 'block',
                          }}
                        />
                      ) : (
                        <span style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#94A3B8', fontSize: '13px',
                        }}>No image</span>
                      )}

                      {/* Correct / wrong overlay indicator */}
                      {answered && opt.isAns && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          backgroundColor: '#22C55E',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 900, fontSize: '16px',
                        }}>
                          ✓
                        </div>
                      )}
                      {wrongIdx === idx && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          backgroundColor: '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 900, fontSize: '16px',
                        }}>
                          ✕
                        </div>
                      )}

                      {/* Zoom button — bottom right */}
                      {imgUrl && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setZoomUrl(imgUrl) }}
                          title="View full image"
                          style={{
                            position: 'absolute', bottom: 8, right: 8,
                            width: 28, height: 28, borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.35)', border: 'none',
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <ZoomIn size={14} color="white" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '14px' }}>
                No image options added yet.
              </div>
            )}

            {/* Reset button — shown after correct answer */}
            {answered && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button" onClick={reset}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#0F766E', color: 'white', border: 'none',
                    borderRadius: '999px', padding: '8px 20px',
                    fontFamily: 'Quicksand, sans-serif', fontWeight: 700,
                    fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} /> Try Again
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom lightbox */}
      <Dialog open={!!zoomUrl} onOpenChange={(o) => !o && setZoomUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none [&>button]:text-white [&>button]:hover:text-white/70">
          <DialogTitle className="sr-only">Image zoom</DialogTitle>
          {zoomUrl && (
            <img src={zoomUrl} alt="zoom" className="w-full h-auto max-h-[80vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
