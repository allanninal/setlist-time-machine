import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'

// Shrink the artist name on the poster so long names don't overflow the fixed
// 1080px-wide canvas (Anton is a tall, wide display face).
function nameFontSize(name) {
  const len = name.length
  if (len > 22) return '58px'
  if (len > 16) return '72px'
  if (len > 11) return '86px'
  return '96px'
}

// A shareable, downloadable concert-poster PNG of the setlist.
// The poster node is rendered off-screen at a fixed size, then rasterised.
export default function Poster({ data, mmss, runtimeLabel }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const { artist, sections, stats } = data

  async function download() {
    if (!ref.current) return
    setBusy(true)
    try {
      // toBlob (vs a giant data URI) is far more reliable for downloads,
      // especially on mobile Safari.
      const blob = await toBlob(ref.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#0a0710',
      })
      if (!blob) throw new Error('empty render')
      const fileName = `${artist.name.replace(/[^\w]+/g, '-').toLowerCase()}-dream-setlist.png`

      // On mobile, prefer the native share sheet (Save to Photos, etc.).
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${artist.name} — dream setlist` })
          return
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return // user dismissed the sheet
          // otherwise fall through to a normal download
        }
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      console.error('poster export failed', err)
      alert('Sorry — the poster export failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  let n = 0
  return (
    <>
      <button className="poster-btn" onClick={download} disabled={busy}>
        {busy ? 'Rendering…' : '⬇ Download poster'}
      </button>

      {/* Off-screen render target for the export */}
      <div className="poster-stage" aria-hidden="true">
        <div className="poster" ref={ref}>
          <div className="poster-glow" />
          <div className="poster-top">
            <p className="poster-presents">The Dream Tour presents</p>
            <img
              className="poster-photo"
              src={`/api/img?url=${encodeURIComponent(artist.picture)}`}
              alt=""
              crossOrigin="anonymous"
            />
            <h1 className="poster-name" style={{ fontSize: nameFontSize(artist.name) }}>
              {artist.name}
            </h1>
            <p className="poster-meta">
              {stats.songs} songs · {runtimeLabel(stats.runtimeSeconds)} · one perfect night
            </p>
          </div>

          <div className="poster-list">
            {sections.map((section) => (
              <div className="poster-section" key={section.name}>
                <p className="poster-section-name">{section.name}</p>
                {section.tracks.map((t) => {
                  n += 1
                  return (
                    <div className="poster-track" key={t.id}>
                      <span className="poster-track-num">{String(n).padStart(2, '0')}</span>
                      <span className="poster-track-title">{t.title}</span>
                      <span className="poster-track-time">{mmss(t.duration)}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <p className="poster-brand">🎤 Setlist Time Machine</p>
        </div>
      </div>
    </>
  )
}
