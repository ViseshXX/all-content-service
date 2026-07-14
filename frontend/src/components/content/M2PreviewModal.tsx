import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { S3_BASE_URL, PlayAudioButton } from './MediaPreview'
import type { Content } from '@/types'

const LANG_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', te: 'తెలుగు',
  kn: 'ಕನ್ನಡ', ta: 'தமிழ்', gu: 'ગુજરాતી', ma: 'मराठी',
}

function resolveUrl(raw: string | undefined, folder: string): string {
  if (!raw) return ''
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return `${S3_BASE_URL}/${folder}/${raw}`
}

type TileStatus = 'idle' | 'selected' | 'correct' | 'wrong'

interface Tile { text: string; status: TileStatus }

interface Props {
  content: Content | null
  open: boolean
  onClose: () => void
}

function tileStyle(status: TileStatus): React.CSSProperties {
  switch (status) {
    case 'selected': return { backgroundColor: '#1CB0F6', color: '#fff', borderColor: '#1CB0F6', transform: 'scale(1.03)' }
    case 'correct':  return { backgroundColor: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC', opacity: 0.55, cursor: 'default' }
    case 'wrong':    return { backgroundColor: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }
    default:         return { backgroundColor: '#FFFFFF', color: '#1E3A5F', borderColor: '#E2E8F0' }
  }
}

export function M2PreviewModal({ content, open, onClose }: Props) {
  const mechanic      = content?.mechanics_data?.find((m) => m.mechanics_id === 'M2_L')
  const wordsList     = mechanic?.words ?? []
  const imageAudioMap = mechanic?.imageAudioMap ?? []
  const lang          = content?.language ?? 'en'

  const [tiles,          setTiles]          = React.useState<Tile[]>([])
  const [selected,       setSelected]       = React.useState<number[]>([])   // up to 2 tile indices
  const [currentWordIdx, setCurrentWordIdx] = React.useState(0)
  const [showHint,       setShowHint]       = React.useState(false)
  const [playing,        setPlaying]        = React.useState(false)
  const [allDone,        setAllDone]        = React.useState(false)

  const audioRef     = React.useRef<HTMLAudioElement>(null)
  const hintTimer    = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimer   = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function init() {
    setTiles(wordsList.map((w) => ({ text: w, status: 'idle' })))
    setSelected([])
    setCurrentWordIdx(0)
    setShowHint(false)
    setPlaying(false)
    setAllDone(false)
    audioRef.current?.pause()
  }

  // Re-initialise whenever the content changes or the modal opens
  React.useEffect(() => { init() }, [content?._id, open])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timers on unmount
  React.useEffect(() => () => {
    if (hintTimer.current)  clearTimeout(hintTimer.current)
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
  }, [])

  const currentEntry = imageAudioMap[currentWordIdx]
  const audioUrl     = resolveUrl(currentEntry?.audio_url, 'mechanics_audios')
  const hintImageUrl = resolveUrl(currentEntry?.image_url, 'mechanics_images')

  function handleTileClick(idx: number) {
    const tile = tiles[idx]
    if (tile.status === 'correct' || tile.status === 'wrong' || allDone) return

    // Deselect if already selected
    if (tile.status === 'selected') {
      setSelected((prev) => prev.filter((i) => i !== idx))
      setTiles((prev) => prev.map((t, i) => i === idx ? { ...t, status: 'idle' } : t))
      return
    }

    if (selected.length >= 2) return // Already evaluating

    const newSelected = [...selected, idx]

    if (newSelected.length === 1) {
      // First tile — just highlight it
      setSelected(newSelected)
      setTiles((prev) => prev.map((t, i) => i === idx ? { ...t, status: 'selected' } : t))
      return
    }

    // Second tile — validate immediately (tiles state is stale here; read text directly)
    const [i1] = selected
    const t1 = tiles[i1].text
    const t2 = tile.text
    const target = currentEntry?.text?.trim() ?? ''
    const isCorrect = target !== '' && (t1 + t2 === target || t2 + t1 === target)

    if (isCorrect) {
      setTiles((prev) =>
        prev.map((t, i) => (i === i1 || i === idx) ? { ...t, status: 'correct' } : t)
      )
      setSelected([])

      const nextIdx = currentWordIdx + 1
      if (nextIdx >= imageAudioMap.length) {
        setAllDone(true)
      } else {
        setCurrentWordIdx(nextIdx)
        setShowHint(false)
        audioRef.current?.pause()
        setPlaying(false)
      }
    } else {
      // Flash wrong then reset to idle
      setTiles((prev) =>
        prev.map((t, i) => (i === i1 || i === idx) ? { ...t, status: 'wrong' } : t)
      )
      setSelected([])
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      wrongTimer.current = setTimeout(() => {
        setTiles((prev) =>
          prev.map((t) => t.status === 'wrong' ? { ...t, status: 'idle' } : t)
        )
      }, 700)
    }
  }

  function handleHint() {
    if (!hintImageUrl) return
    setShowHint(true)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setShowHint(false), 2000)
  }

  function toggleAudio() {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) { el.pause(); setPlaying(false) }
    else            { el.play();  setPlaying(true)  }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="border-none p-5 max-w-[90vw] w-[90vw] h-[85vh] flex flex-col [&>button]:text-white/80 [&>button]:hover:text-white"
        style={{ backgroundColor: '#DB2777' }}
      >
        <DialogTitle className="sr-only">M2 Preview — {content?.name}</DialogTitle>

        {/* Header bar */}
        <div className="flex items-center justify-between mb-3 pr-6">
          <p className="italic text-white/90 text-sm tracking-wide">M2 — Bingo Puzzle</p>
          <span style={{
            background: '#BE185D', color: 'white', fontSize: '13px', fontWeight: 700,
            padding: '4px 14px', borderRadius: '20px', fontFamily: 'Quicksand, sans-serif',
          }}>
            {LANG_LABELS[lang] ?? lang}
          </span>
        </div>

        {/* Main card */}
        <div style={{
          backgroundColor: '#EBF4FF', borderRadius: '20px',
          padding: '24px 24px 20px', flex: 1,
          display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden',
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'Quicksand, sans-serif', fontWeight: 900,
              fontSize: '28px', color: '#1E3A5F', letterSpacing: '0.5px',
            }}>
              BINGO PUZZLE
            </span>
            <button
              type="button" onClick={init}
              title="Restart"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                color: '#64748B', fontSize: '12px',
              }}
            >
              <RotateCcw size={14} /> Restart
            </button>
          </div>

          {/* Current word progress */}
          {imageAudioMap.length > 0 && !allDone && (
            <div style={{
              fontSize: '12px', color: '#64748B',
              fontFamily: 'Quicksand, sans-serif', fontWeight: 600,
            }}>
              Word {currentWordIdx + 1} of {imageAudioMap.length}
              {' — '}
              <span style={{ color: '#1E3A5F' }}>
                Listen and find: <strong>{currentEntry?.text}</strong>
              </span>
            </div>
          )}

          {allDone ? (
            /* ── Completion state ── */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '16px',
            }}>
              <div style={{ fontSize: '48px' }}>🎉</div>
              <div style={{
                fontFamily: 'Quicksand, sans-serif', fontWeight: 800,
                fontSize: '24px', color: '#15803D',
              }}>
                All words matched!
              </div>
              <button
                type="button" onClick={init}
                style={{
                  background: '#DB2777', color: 'white', border: 'none',
                  borderRadius: '999px', padding: '10px 28px',
                  fontFamily: 'Quicksand, sans-serif', fontWeight: 700,
                  fontSize: '15px', cursor: 'pointer',
                }}
              >
                Play Again
              </button>
            </div>
          ) : (
            <>
              {/* ── Tile grid ── */}
              {tiles.length > 0 ? (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px', flex: 1, overflowY: 'auto',
                }}>
                  {tiles.map((tile, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleTileClick(i)}
                      disabled={tile.status === 'correct'}
                      style={{
                        borderRadius: '12px', border: '1.5px solid',
                        padding: '14px 8px', textAlign: 'center',
                        fontFamily: 'Quicksand, sans-serif', fontWeight: 600,
                        fontSize: '20px', cursor: tile.status === 'correct' ? 'default' : 'pointer',
                        transition: 'all 0.15s ease', userSelect: 'none',
                        ...tileStyle(tile.status),
                      }}
                    >
                      {tile.text}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#94A3B8', fontSize: '14px',
                }}>
                  No words added yet.
                </div>
              )}

              {/* ── Controls: hint + audio ── */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: '20px', paddingTop: '4px' }}>
                {/* Hint image popup — auto-hides after 2s */}
                {showHint && hintImageUrl && (
                  <div style={{
                    position: 'absolute', bottom: '72px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'white', borderRadius: '14px', padding: '8px',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
                    display: 'flex', alignItems: 'center',
                    zIndex: 10,
                  }}>
                    <img
                      src={hintImageUrl} alt="hint"
                      style={{ width: 140, height: 140, objectFit: 'contain', borderRadius: '10px' }}
                    />
                  </div>
                )}

                {/* Orange hint (?) button */}
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={!hintImageUrl}
                  title={hintImageUrl ? 'Show hint image (2s)' : 'No hint image'}
                  style={{
                    width: 56, height: 56, borderRadius: '50%', border: 'none', flexShrink: 0,
                    backgroundColor: hintImageUrl ? '#F59E0B' : '#D1D5DB',
                    cursor: hintImageUrl ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '28px', color: 'white',
                    boxShadow: hintImageUrl ? '0 4px 12px rgba(245,158,11,0.4)' : 'none',
                  }}
                >
                  ?
                </button>

                {/* Audio button */}
                <PlayAudioButton size={56} playing={playing} onClick={toggleAudio} disabled={!audioUrl} />
                {audioUrl && (
                  <audio
                    ref={audioRef} src={audioUrl} preload="metadata"
                    onEnded={() => setPlaying(false)}
                    onPause={() => setPlaying(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
