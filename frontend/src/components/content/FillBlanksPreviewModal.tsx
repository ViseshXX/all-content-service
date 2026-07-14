import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, ClickableImage } from './MediaPreview'
import type { Content } from '@/types'

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુજરાতી', ma: 'मराठी',
}

function resolveImageUrl(raw: string | undefined): string {
  if (!raw) return ''
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return `${S3_BASE_URL}/mechanics_images/${raw}`
}

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

export function FillBlanksPreviewModal({ content, open, onClose }: Props) {
  const mechanic = content?.mechanics_data?.find((m) => m.mechanics_id === 'mechanic_1')
  const options  = mechanic?.options ?? []
  const lang     = content?.language ?? 'en'
  const text     = mechanic?.text ?? ''
  const imageUrl = resolveImageUrl(mechanic?.image_url)

  const [answered,  setAnswered]  = React.useState(false)
  const [wrongIdx,  setWrongIdx]  = React.useState<number | null>(null)
  const wrongTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setAnswered(false)
    setWrongIdx(null)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { reset() }, [content?._id, open])

  React.useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
  }, [])

  function handleSelect(idx: number, isAns: boolean) {
    if (answered || wrongIdx !== null) return
    if (isAns) {
      setAnswered(true)
    } else {
      setWrongIdx(idx)
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      wrongTimer.current = setTimeout(() => setWrongIdx(null), 800)
    }
  }

  function rowBg(idx: number, isAns: boolean): string {
    if (answered && isAns) return '#F0FDF4'
    if (wrongIdx === idx)  return '#FEF2F2'
    return 'transparent'
  }

  function radioStyle(idx: number, isAns: boolean): React.CSSProperties {
    if (answered && isAns)
      return { border: '3px solid #16A34A', background: '#16A34A' }
    if (wrongIdx === idx)
      return { border: '3px solid #DC2626', background: '#DC2626' }
    return { border: '3px solid #CBD5E1', background: 'white' }
  }

  function textColor(idx: number, isAns: boolean): string {
    if (answered && isAns) return '#16A34A'
    if (wrongIdx === idx)  return '#DC2626'
    return '#1E293B'
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="border-none p-5 max-w-[90vw] w-[90vw] h-[85vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
        style={{ backgroundColor: '#6D28D9' }}
      >
        <DialogTitle className="sr-only">Fill in the Blanks — {content?.name}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 pr-6">
          <p className="italic text-white/90 text-sm tracking-wide">Fill in the Blanks</p>
          <span style={{
            background: '#5B21B6', color: 'white', fontSize: '13px', fontWeight: 700,
            padding: '4px 14px', borderRadius: '20px', fontFamily: 'Quicksand, sans-serif',
          }}>
            {LANG_LABELS[lang] ?? lang}
          </span>
        </div>

        {/* White card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '20px',
          padding: '28px 32px', flex: 1,
          display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden',
        }}>
          {/* Instruction */}
          <p style={{
            fontFamily: 'Quicksand, sans-serif', fontWeight: 700,
            fontSize: '22px', color: '#1E3A5F', textAlign: 'center', margin: 0,
          }}>
            Look at the picture and speak the correct answer from below
          </p>

          {/* Image (left) + sentence + options (right) */}
          <div style={{ display: 'flex', gap: '32px', flex: 1, overflow: 'hidden', alignItems: 'center' }}>
            {/* Image */}
            <div style={{ flex: '0 0 220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imageUrl ? (
                <ClickableImage
                  src={imageUrl}
                  alt="mechanic image"
                  className="w-[210px] h-[210px] rounded-[15px] object-contain"
                />
              ) : (
                <div style={{
                  width: '210px', height: '210px', borderRadius: '15px',
                  background: '#F1F5F9', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#94A3B8', fontSize: '13px',
                }}>
                  No image
                </div>
              )}
            </div>

            {/* Right pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Sentence */}
              <p style={{
                fontFamily: 'Quicksand, sans-serif', fontWeight: 800,
                fontSize: '26px', color: '#1E293B', margin: 0,
                borderBottom: '1px solid #E2E8F0', paddingBottom: '14px',
              }}>
                {text || <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '18px' }}>No text</span>}
              </p>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(idx, !!opt.isAns)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '10px 14px', borderRadius: '10px',
                      background: rowBg(idx, !!opt.isAns),
                      cursor: answered || wrongIdx !== null ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Radio */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...radioStyle(idx, !!opt.isAns),
                    }}>
                      {(answered && opt.isAns) && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                      )}
                    </div>

                    {/* Text */}
                    <span style={{
                      fontFamily: 'Quicksand, sans-serif',
                      fontSize: '22px',
                      fontWeight: (answered && opt.isAns) || wrongIdx === idx ? 800 : 600,
                      color: textColor(idx, !!opt.isAns),
                    }}>
                      {opt.text}
                    </span>
                  </div>
                ))}
              </div>

              {answered && (
                <button
                  type="button"
                  onClick={reset}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    alignSelf: 'flex-start',
                    background: '#6D28D9', color: 'white', border: 'none',
                    borderRadius: '999px', padding: '8px 20px',
                    fontFamily: 'Quicksand, sans-serif', fontWeight: 700,
                    fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} /> Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
