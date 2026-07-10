// Thin client for Deezer's public API (no auth key required).
const BASE = 'https://api.deezer.com'
const REQUEST_TIMEOUT_MS = 8000

async function deezer(path) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    // AbortSignal.timeout throws a TimeoutError; normalise the message.
    throw new Error(`Deezer request timed out or failed for ${path}: ${err.message}`)
  }
  if (!res.ok) {
    throw new Error(`Deezer request failed (${res.status}) for ${path}`)
  }
  const json = await res.json()
  // Deezer returns { error: {...} } with a 200 status for some failures.
  if (json && json.error) {
    throw new Error(`Deezer API error: ${json.error.message || 'unknown'}`)
  }
  return json
}

// Run async tasks with a bounded concurrency so we don't fan out 30+ requests
// at once and trip Deezer's per-IP rate limit (all Cloud Run traffic shares one IP).
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Find the best-matching artist for a free-text query.
export async function findArtist(query) {
  const data = await deezer(`/search/artist?q=${encodeURIComponent(query)}&limit=5`)
  const results = data.data || []
  if (results.length === 0) return null

  // Prefer an exact (case-insensitive) name match, else the most-fanned artist.
  const q = query.trim().toLowerCase()
  const exact = results.find((a) => a.name.toLowerCase() === q)
  const best = exact || [...results].sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0]

  return {
    id: best.id,
    name: best.name,
    picture: best.picture_xl || best.picture_big || best.picture_medium || '',
    fans: best.nb_fan || 0,
    albums: best.nb_album || 0,
  }
}

function mapTrack(t, albumTitle = '', albumCover = '') {
  return {
    id: t.id,
    title: t.title_short || t.title,
    duration: t.duration || 0, // seconds
    rank: t.rank || 0, // Deezer popularity score (global scale)
    preview: t.preview || '', // 30s mp3 URL (may be empty)
    album: t.album?.title || albumTitle,
    cover: t.album?.cover_medium || t.album?.cover || albumCover,
    explicit: Boolean(t.explicit_lyrics),
    link: t.link || '',
  }
}

// Fetch an artist's most popular tracks (ranked by Deezer popularity).
export async function getTopTracks(artistId, limit = 100) {
  const data = await deezer(`/artist/${artistId}/top?limit=${limit}`)
  return (data.data || []).map((t) => mapTrack(t))
}

// The `top` endpoint only returns the hits. To find real *deep cuts* we also
// walk the artist's studio albums and pull their full tracklists.
async function getAlbumTracks(album) {
  try {
    const data = await deezer(`/album/${album.id}/tracks?limit=100`)
    return (data.data || []).map((t) =>
      mapTrack(t, album.title, album.cover_medium || album.cover),
    )
  } catch {
    return [] // one bad album shouldn't sink the whole catalog
  }
}

// Tracks that aren't really "songs" you'd put in a setlist.
const NON_SONG = /\b(reprise|intro|outro|interlude|skit|instrumental|commentary|demo|voice memo|hidden)\b/i

// Build the catalog as two buckets:
//   hits  — Deezer's curated top tracks (reliable popularity → opener/main/encore)
//   deep  — everything else from the studio albums (the die-hard deep cuts)
export async function getCatalog(artistId) {
  const [hits, albumsData] = await Promise.all([
    getTopTracks(artistId, 100),
    deezer(`/artist/${artistId}/albums?limit=100`).catch(() => ({ data: [] })),
  ])

  const hitIds = new Set(hits.map((t) => t.id))

  const albums = (albumsData.data || [])
    .filter((a) => a.record_type === 'album') // skip singles/EPs/compilations
    .slice(0, 30) // cap fan-out for speed

  // Bounded concurrency keeps us under Deezer's per-IP rate limit.
  const albumTrackLists = await mapLimit(albums, 6, getAlbumTracks)

  // Deep pool = album tracks that aren't already hits, deduped by id, real songs only.
  const deepById = new Map()
  for (const t of albumTrackLists.flat()) {
    if (hitIds.has(t.id)) continue
    if (t.duration < 90) continue
    if (NON_SONG.test(t.title)) continue
    const existing = deepById.get(t.id)
    if (!existing || t.rank > existing.rank) deepById.set(t.id, t)
  }

  return { hits, deep: [...deepById.values()] }
}
