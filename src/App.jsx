import { useEffect, useRef, useState } from 'react'
import Poster from './Poster.jsx'

const EXAMPLES = ['Queen', 'Radiohead', 'Fleetwood Mac', 'Beyoncé', 'Arctic Monkeys', 'Kendrick Lamar']

function mmss(sec) {
  const m = Math.floor(sec / 60)
  const s = String(Math.round(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function runtimeLabel(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function App() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | error | done
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [nowPlaying, setNowPlaying] = useState(null)
  const audioRef = useRef(null)

  async function buildShow(artist) {
    const name = (artist ?? query).trim()
    if (!name) return
    setQuery(name)
    setStatus('loading')
    setError('')
    stopAudio()
    try {
      const res = await fetch(`/api/setlist?artist=${encodeURIComponent(name)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
      setData(json)
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setNowPlaying(null)
  }

  function togglePreview(track) {
    if (nowPlaying === track.id) {
      stopAudio()
      return
    }
    stopAudio()
    if (!track.preview) return
    const audio = new Audio(track.preview)
    audio.volume = 0.9
    audio.play().catch(() => {})
    audio.onended = () => setNowPlaying(null)
    audioRef.current = audio
    setNowPlaying(track.id)
  }

  useEffect(() => () => stopAudio(), [])

  return (
    <div className="page">
      <div className="stage-lights" aria-hidden="true" />

      <header className="hero">
        <p className="kicker">🎤 Setlist Time Machine</p>
        <h1 className="title">
          Build any artist's
          <span className="title-accent"> dream concert.</span>
        </h1>
        <p className="subtitle">
          Type a band. We dig through their whole catalog and arrange the perfect show —
          opener, main set, deep cuts for the die-hards, and an encore that lands on the anthem.
        </p>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            buildShow()
          }}
        >
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an artist…  e.g. Queen"
            autoFocus
            spellCheck="false"
          />
          <button className="search-btn" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Booking…' : 'Build the show'}
          </button>
        </form>

        <div className="examples">
          <span className="examples-label">Try:</span>
          {EXAMPLES.map((name) => (
            <button key={name} className="chip" onClick={() => buildShow(name)}>
              {name}
            </button>
          ))}
        </div>
      </header>

      <main className="results">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && (
          <div className="notice error">
            <strong>Couldn't book that show.</strong>
            <span>{error}</span>
          </div>
        )}
        {status === 'done' && data && (
          <Show
            data={data}
            nowPlaying={nowPlaying}
            onToggle={togglePreview}
            mmss={mmss}
            runtimeLabel={runtimeLabel}
          />
        )}
      </main>

      <footer className="footer">
        Built for the DEV Weekend Challenge · Passion Edition · Data by Deezer
      </footer>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="loading">
      <div className="equalizer" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
      <p>Sound-checking the setlist…</p>
    </div>
  )
}

function Show({ data, nowPlaying, onToggle, mmss, runtimeLabel }) {
  const { artist, sections, stats } = data
  let counter = 0
  return (
    <section className="show">
      <div className="show-head">
        <img
          className="artist-photo"
          src={`/api/img?url=${encodeURIComponent(artist.picture)}`}
          alt={artist.name}
          crossOrigin="anonymous"
        />
        <div className="show-head-text">
          <p className="show-tour">The Dream Tour presents</p>
          <h2 className="artist-name">{artist.name}</h2>
          <div className="stat-row">
            <span className="stat"><b>{stats.songs}</b> songs</span>
            <span className="stat"><b>{runtimeLabel(stats.runtimeSeconds)}</b> runtime</span>
            <span className="stat"><b>{stats.deepCuts}</b> deep cuts</span>
            {artist.fans > 0 && (
              <span className="stat"><b>{Intl.NumberFormat().format(artist.fans)}</b> fans</span>
            )}
          </div>
        </div>
        <Poster data={data} mmss={mmss} runtimeLabel={runtimeLabel} />
      </div>

      <div className="setlist">
        {sections.map((section) => (
          <div className="section" key={section.name}>
            <div className="section-head">
              <h3>{section.name}</h3>
              <p>{section.tagline}</p>
            </div>
            <ul className="tracks">
              {section.tracks.map((track) => {
                counter += 1
                const playing = nowPlaying === track.id
                return (
                  <li key={track.id} className={`track ${playing ? 'is-playing' : ''}`}>
                    <span className="track-num">{String(counter).padStart(2, '0')}</span>
                    <button
                      className={`play ${playing ? 'playing' : ''}`}
                      onClick={() => onToggle(track)}
                      disabled={!track.preview}
                      title={track.preview ? 'Play 30s preview' : 'No preview available'}
                      aria-label={playing ? 'Pause preview' : 'Play preview'}
                    >
                      {playing ? '❚❚' : '▶'}
                    </button>
                    <span className="track-title">
                      {track.title}
                      {track.explicit && <span className="explicit">E</span>}
                    </span>
                    <span className="track-time">{mmss(track.duration)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
