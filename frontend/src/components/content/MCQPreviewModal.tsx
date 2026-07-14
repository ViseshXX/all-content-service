import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, ClickableImage } from './MediaPreview'
import type { Content, MechanicsEntry } from '@/types'

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુజรাதી', ma: 'मराठी',
}

/** Blue circle play/pause button — original MCQ style */
function AudioBtn({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'linear-gradient(135deg, #29B6F6, #0288D1)',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(2,136,209,0.35)',
      }}
    >
      {playing ? (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="white">
          <rect x="2.5" y="2.5" width="3.5" height="10" rx="1" />
          <rect x="9" y="2.5" width="3.5" height="10" rx="1" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="white">
          <polygon points="4,2 13,7.5 4,13" />
        </svg>
      )}
    </button>
  )
}

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

export function MCQPreviewModal({ content, open, onClose }: Props) {
  const mechanic: MechanicsEntry | undefined = content?.mechanics_data?.find(
    (m) => m.mechanics_id === 'mechanic_2'
  )

  const questionAudioRef  = React.useRef<HTMLAudioElement>(null)
  const optionAudioRefs   = React.useRef<HTMLAudioElement[]>([])
  const [playingKey, setPlayingKey] = React.useState<string | null>(null)

  const [answered,  setAnswered]  = React.useState(false)
  const [wrongIdx,  setWrongIdx]  = React.useState<number | null>(null)
  const wrongTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setAnswered(false)
    setWrongIdx(null)
    setPlayingKey(null)
    questionAudioRef.current?.pause()
    optionAudioRefs.current.forEach((el) => el?.pause())
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { reset() }, [content?._id, open])

  React.useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
  }, [])

  function toggleAudio(key: string, audioEl: HTMLAudioElement | null) {
    if (!audioEl) return
    if (playingKey === key && !audioEl.paused) {
      audioEl.pause()
      setPlayingKey(null)
    } else {
      questionAudioRef.current?.pause()
      optionAudioRefs.current.forEach((el) => el?.pause())
      audioEl.play()
      setPlayingKey(key)
    }
  }

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

  const lang = content?.language ?? 'en'

  function resolveUrl(raw: string | undefined, s3Folder: string): string {
    if (!raw) return ''
    if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
    return `${S3_BASE_URL}/${s3Folder}/${raw}`
  }

  const imageUrl         = resolveUrl(mechanic?.image_url,  'mechanics_images')
  const questionAudioUrl = resolveUrl(mechanic?.audio_url,  'mechanics_audios')
  const options          = mechanic?.options ?? []

  function rowBg(idx: number, isAns: boolean): string {
    if (answered && isAns) return '#F0FDF4'
    if (wrongIdx === idx)  return '#FEF2F2'
    return 'transparent'
  }

  function textColor(idx: number, isAns: boolean): string {
    if (answered && isAns) return '#16A34A'
    if (wrongIdx === idx)  return '#DC2626'
    return '#262649'
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="border-none p-5 max-w-[90vw] w-[90vw] h-[85vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
        style={{ backgroundColor: '#7C3AED' }}
      >
        <DialogTitle className="sr-only">MCQ Preview — {content?.name}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pr-6">
          <p className="italic text-white/90 text-sm tracking-wide">MCQ</p>
          <span style={{
            background: '#5B21B6',
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
          flexDirection: 'column',
          padding: '32px',
          gap: '24px',
          flex: 1,
          overflowY: 'auto',
        }}>
          {!mechanic ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#888', fontSize: '14px' }}>
              No MCQ mechanic data found for this content.
            </div>
          ) : (
            <>
              {/* Instruction */}
              <div style={{
                fontFamily: 'Quicksand, sans-serif',
                fontWeight: 600, fontSize: '26px',
                color: '#333F61', textAlign: 'center',
              }}>
                Look at the picture and speak the correct answer from below
              </div>

              {/* Image + MCQ row */}
              <div style={{
                display: 'flex', flexDirection: 'row',
                alignItems: 'flex-start', gap: '32px', flex: 1,
              }}>
                {/* Image */}
                <div style={{ flexShrink: 0 }}>
                  {imageUrl ? (
                    <ClickableImage
                      src={imageUrl}
                      alt="content"
                      className="w-[250px] h-[250px] rounded-[15px] object-cover"
                    />
                  ) : (
                    <div style={{
                      width: '250px', height: '250px', borderRadius: '15px',
                      background: '#f0f0f0', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#aaa', fontSize: '13px',
                    }}>
                      No image
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', backgroundColor: '#E0E2E7', alignSelf: 'stretch' }} />

                {/* MCQ section */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {/* Question text + audio */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    {questionAudioUrl && (
                      <>
                        <AudioBtn
                          playing={playingKey === 'question'}
                          onClick={() => toggleAudio('question', questionAudioRef.current)}
                        />
                        <audio
                          ref={questionAudioRef}
                          src={questionAudioUrl}
                          preload="metadata"
                          onEnded={() => setPlayingKey(null)}
                          onPause={() => setPlayingKey((k) => k === 'question' ? null : k)}
                        />
                      </>
                    )}
                    <span style={{
                      color: '#262649', fontWeight: 800,
                      fontSize: '26px', fontFamily: 'Quicksand, sans-serif',
                    }}>
                      {mechanic.text}
                    </span>
                  </div>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {options.map((option, i) => {
                      const optKey      = `opt-${i}`
                      const optAudioUrl = resolveUrl(option.audio_url, 'mechanics_audios')
                      return (
                        <div
                          key={i}
                          onClick={() => handleSelect(i, !!option.isAns)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', borderRadius: '10px',
                            background: rowBg(i, !!option.isAns),
                            cursor: answered || wrongIdx !== null ? 'default' : 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name="mcq-preview"
                            readOnly
                            checked={answered && !!option.isAns}
                            style={{ transform: 'scale(1.5)', cursor: 'default', flexShrink: 0, accentColor: answered && option.isAns ? '#16A34A' : undefined }}
                          />
                          {optAudioUrl && (
                            <>
                              <AudioBtn
                                playing={playingKey === optKey}
                                onClick={(e?: any) => { e?.stopPropagation?.(); toggleAudio(optKey, optionAudioRefs.current[i]) }}
                              />
                              <audio
                                ref={(el) => { if (el) optionAudioRefs.current[i] = el }}
                                src={optAudioUrl}
                                preload="metadata"
                                onEnded={() => setPlayingKey(null)}
                                onPause={() => setPlayingKey((k) => k === optKey ? null : k)}
                              />
                            </>
                          )}
                          <span style={{
                            color: textColor(i, !!option.isAns),
                            fontWeight: (answered && option.isAns) || wrongIdx === i ? 800 : 600,
                            fontSize: '24px', fontFamily: 'Quicksand, sans-serif',
                          }}>
                            {option.text}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Try Again */}
                  {answered && (
                    <div style={{ marginTop: '20px' }}>
                      <button
                        type="button"
                        onClick={reset}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          background: '#7C3AED', color: 'white', border: 'none',
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
