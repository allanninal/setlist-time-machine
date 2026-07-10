import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSetlist } from './setlist.js'

// Helper to fabricate a track. Only id/title/duration/rank matter to the algorithm.
function track(id, title, rank, duration = 200) {
  return { id, title, rank, duration, preview: `p${id}`, album: 'Album', explicit: false }
}

// A healthy catalog: 14 ranked hits + 10 lower-ranked deep cuts.
function bigCatalog() {
  const hits = Array.from({ length: 14 }, (_, i) =>
    track(i + 1, `Hit ${i + 1}`, 100000 - i * 1000),
  )
  const deep = Array.from({ length: 10 }, (_, i) =>
    track(100 + i, `Deep ${i + 1}`, 40000 - i * 1000),
  )
  return { hits, deep }
}

const titlesOf = (s) => s.sections.flatMap((sec) => sec.tracks.map((t) => t.title))

test('sections appear in concert order', () => {
  const { hits, deep } = bigCatalog()
  const s = buildSetlist(hits, deep)
  assert.deepEqual(
    s.sections.map((x) => x.name),
    ['Opener', 'Main Set', 'For the Die-Hards', 'Encore'],
  )
})

test('encore closes on the single biggest hit', () => {
  const { hits, deep } = bigCatalog()
  const s = buildSetlist(hits, deep)
  const encore = s.sections.at(-1).tracks
  assert.equal(encore.at(-1).title, 'Hit 1', 'the #1 hit should be the finale')
})

test('opener is a hit but not the biggest (that is saved for the encore)', () => {
  const { hits, deep } = bigCatalog()
  const s = buildSetlist(hits, deep)
  const opener = s.sections[0].tracks[0]
  assert.match(opener.title, /^Hit /)
  assert.notEqual(opener.title, 'Hit 1')
})

test('deep-cut section is drawn from the deep pool, not the hits', () => {
  const { hits, deep } = bigCatalog()
  const s = buildSetlist(hits, deep)
  const deepSection = s.sections.find((x) => x.name === 'For the Die-Hards')
  for (const t of deepSection.tracks) {
    assert.match(t.title, /^Deep /, `${t.title} should be a deep cut`)
  }
})

test('no song appears twice across the whole show', () => {
  const { hits, deep } = bigCatalog()
  const titles = titlesOf(buildSetlist(hits, deep))
  assert.equal(new Set(titles).size, titles.length)
})

test('show is capped at 18 songs and runtime is the exact sum', () => {
  const { hits, deep } = bigCatalog()
  const s = buildSetlist(hits, deep)
  assert.ok(s.stats.songs <= 18)
  const all = s.sections.flatMap((sec) => sec.tracks)
  assert.equal(s.stats.songs, all.length)
  assert.equal(
    s.stats.runtimeSeconds,
    all.reduce((sum, t) => sum + t.duration, 0),
  )
})

test('deduplicates remaster/live/feat title variants, keeping the highest rank', () => {
  const hits = [
    track(1, 'Anthem', 50000),
    track(2, 'Anthem (Remastered 2011)', 90000),
    track(3, 'Anthem - Live', 30000),
    track(4, 'Other Song', 40000),
  ]
  const s = buildSetlist(hits, [])
  const titles = titlesOf(s)
  const anthems = titles.filter((t) => t.startsWith('Anthem'))
  assert.equal(anthems.length, 1, 'only one Anthem variant should survive')
})

test('thin catalog: borrows deep tracks so a real show still forms', () => {
  const hits = [track(1, 'Only Hit A', 90000), track(2, 'Only Hit B', 80000)]
  const deep = Array.from({ length: 8 }, (_, i) => track(200 + i, `Album Cut ${i + 1}`, 20000 - i * 500))
  const s = buildSetlist(hits, deep)
  assert.ok(s.stats.songs >= 4, 'should assemble at least a few songs')
  assert.ok(s.sections.length >= 2)
})

test('tiny catalog does not throw and returns at least one section', () => {
  const s = buildSetlist([track(1, 'Lonely Single', 100)], [])
  assert.ok(s.sections.length >= 1)
  assert.equal(s.stats.songs, 1)
})

test('empty input yields an empty show rather than crashing', () => {
  const s = buildSetlist([], [])
  assert.equal(s.stats.songs, 0)
  assert.deepEqual(s.sections, [])
})
