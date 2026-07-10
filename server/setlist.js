// Turn a pile of an artist's popular tracks into a believable *concert* setlist.
//
// A real show has an arc: a strong opener, a main set that peaks and dips,
// a "deep cuts" moment for the die-hard fans, then an encore that closes on
// the single biggest anthem. We reconstruct that arc from Deezer popularity.

// Collapse remasters / live / feat variants so the same song doesn't repeat.
function normalizeTitle(t) {
  return t
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*-\s*(remaster|remastered|live|acoustic|radio edit|single version|deluxe|mono|stereo).*/i, '')
    .replace(/feat\.?.*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupe(tracks) {
  const seen = new Map()
  for (const t of tracks) {
    const key = normalizeTitle(t.title) || t.title.toLowerCase()
    const existing = seen.get(key)
    if (!existing || t.rank > existing.rank) seen.set(key, t)
  }
  return [...seen.values()]
}

// Take from both ends of a popularity-sorted list to create peaks and valleys
// so the main set doesn't just decay from most- to least-popular.
function zigzag(sortedDesc) {
  const out = []
  let lo = 0
  let hi = sortedDesc.length - 1
  let takeHi = true
  while (lo <= hi) {
    out.push(sortedDesc[takeHi ? hi-- : lo++])
    takeHi = !takeHi
  }
  return out
}

export function buildSetlist(hits, deep = []) {
  // Hits drive the show's structure; if an artist has thin "top" data,
  // borrow the most-popular deep tracks to round it out.
  let hitPool = dedupe(hits).filter((t) => t.duration > 0)
  let deepPool = dedupe(deep).filter((t) => t.duration > 0)
  // Exclude deep tracks that duplicate a hit — by id *and* by normalized title,
  // so an alt/live version of a hit can't resurface in the deep-cuts section.
  const hitIds = new Set(hitPool.map((t) => t.id))
  const hitTitles = new Set(hitPool.map((t) => normalizeTitle(t.title)))
  deepPool = deepPool.filter((t) => !hitIds.has(t.id) && !hitTitles.has(normalizeTitle(t.title)))

  const byPop = [...hitPool].sort((a, b) => b.rank - a.rank) // biggest hit first
  if (byPop.length < 6 && deepPool.length) {
    const borrow = [...deepPool].sort((a, b) => b.rank - a.rank).slice(0, 6 - byPop.length)
    const borrowIds = new Set(borrow.map((t) => t.id))
    deepPool = deepPool.filter((t) => !borrowIds.has(t.id))
    byPop.push(...borrow)
    byPop.sort((a, b) => b.rank - a.rank)
  }
  const n = byPop.length

  const used = new Set()
  const isFree = (t) => !used.has(t.id)
  const take = (t) => {
    used.add(t.id)
    return t
  }

  // How big a show can this catalog support?
  const maxSongs = Math.min(18, n)
  const encoreN = n >= 12 ? 3 : n >= 6 ? 2 : 1
  const wantDeep = n >= 12 ? 3 : n >= 8 ? 2 : n >= 5 ? 1 : 0

  // 1) Encore = the very biggest hits. Ordered so the #1 anthem closes the night.
  const encore = byPop
    .slice(0, encoreN)
    .map(take)
    .reverse()

  // 2) Opener = the biggest remaining hit — instantly recognizable, high energy.
  const opener = byPop.find(isFree)
  if (opener) take(opener)

  // 3) Deep cuts = fan-favorite album tracks from the mid-lower popularity band.
  //    Skip the very bottom (often filler); pick from ~35th percentile down.
  const deepRanked = [...deepPool].sort((a, b) => b.rank - a.rank)
  const start = Math.floor(deepRanked.length * 0.35)
  const deepCuts = deepRanked.slice(start, start + wantDeep)

  // 4) Main set = next-biggest remaining hits, arranged for dynamics.
  const mainBudget = Math.max(0, maxSongs - 1 - encore.length - deepCuts.length)
  const mainSorted = byPop.filter(isFree).slice(0, mainBudget).map(take)
  const mainSet = zigzag(mainSorted)

  const sections = [
    opener && {
      name: 'Opener',
      tagline: 'Lights down. The roar. Here we go.',
      tracks: [opener],
    },
    mainSet.length && {
      name: 'Main Set',
      tagline: 'The heart of the night — hits, singalongs and a few curveballs.',
      tracks: mainSet,
    },
    deepCuts.length && {
      name: 'For the Die-Hards',
      tagline: 'Deep cuts only the real ones know every word to.',
      tracks: deepCuts,
    },
    encore.length && {
      name: 'Encore',
      tagline: 'They came back out. Save the biggest for last.',
      tracks: encore,
    },
  ].filter(Boolean)

  const allTracks = sections.flatMap((s) => s.tracks)
  const runtimeSeconds = allTracks.reduce((sum, t) => sum + t.duration, 0)

  return {
    sections,
    stats: {
      songs: allTracks.length,
      runtimeSeconds,
      deepCuts: deepCuts.length,
    },
  }
}
