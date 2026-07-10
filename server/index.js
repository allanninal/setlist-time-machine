import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findArtist, getCatalog } from './deezer.js'
import { buildSetlist } from './setlist.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8787

// Tiny in-memory cache so repeated lookups (and the demo) stay snappy.
const cache = new Map()
const CACHE_TTL_MS = 1000 * 60 * 30

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Same-origin image proxy so the exported poster's <canvas> isn't tainted by
// cross-origin Deezer CDN images. Only proxies Deezer/dzcdn hosts.
app.get('/api/img', async (req, res) => {
  const url = (req.query.url || '').toString()
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return res.status(400).end()
  }
  if (!/(^|\.)(dzcdn\.net|deezer\.com)$/.test(host)) {
    return res.status(403).end()
  }
  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).end()
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.send(buf)
  } catch {
    res.status(502).end()
  }
})

app.get('/api/setlist', async (req, res) => {
  const query = (req.query.artist || '').toString().trim()
  if (!query) {
    return res.status(400).json({ error: 'Missing ?artist= query parameter.' })
  }

  const cacheKey = query.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json(cached.payload)
  }

  try {
    const artist = await findArtist(query)
    if (!artist) {
      return res.status(404).json({ error: `No artist found for "${query}".` })
    }

    const { hits, deep } = await getCatalog(artist.id)
    if (!hits.length && !deep.length) {
      return res.status(404).json({ error: `Couldn't find any tracks for ${artist.name}.` })
    }

    const setlist = buildSetlist(hits, deep)
    const payload = { artist, ...setlist }
    cache.set(cacheKey, { at: Date.now(), payload })
    res.json(payload)
  } catch (err) {
    console.error('setlist error:', err)
    res.status(502).json({ error: 'Something went wrong reaching the music service. Try again.' })
  }
})

// Unknown API routes should return JSON 404, not the SPA HTML.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// Serve the built frontend in production.
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🎤 Setlist Time Machine running on http://localhost:${PORT}`)
})
