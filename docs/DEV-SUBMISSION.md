*This is a submission for [Weekend Challenge: Passion Edition](https://dev.to/challenges/weekend-2026-07-09)*

## What I Built

**Setlist Time Machine** — type any artist and it instantly builds the *dream concert* you'd give anything to attend.

I'm the kind of music fan who argues about setlists. Not just *which songs* a band should play, but the **order** — the perfect opener, where the deep cut goes to reward the die-hards, and the one anthem you save for the very last note of the encore. That obsession is the whole app.

You search an artist, and Setlist Time Machine digs through their **entire catalog** — every album track, not just the singles — and arranges it into the arc of a real show:

- **🎬 Opener** — a big, recognizable, high-energy song to open the night.
- **🎸 Main Set** — the hits and singalongs, sequenced with real *dynamics* (energy that rises and dips, not a flat slide down the popularity chart).
- **💜 For the Die-Hards** — genuine deep cuts, the ones only the real fans know every word to.
- **🔥 Encore** — the biggest anthems, closing on the single most-loved song of all.

Every track has a **30-second preview** you can play, and you can **download the whole thing as a shareable concert poster** to settle the "what would the perfect show be" argument with your friends.

## Demo

🔗 **Live app:** https://setlist-time-machine-644564019699.us-central1.run.app

Try `Queen`, `Radiohead`, `Fleetwood Mac`, `Kendrick Lamar` — or your own obsession.

Here's the app building Queen's dream show:

![The app building Queen's dream setlist](https://raw.githubusercontent.com/allanninal/REPO/main/docs/screenshot.png)

…and the downloadable concert poster it generates for Radiohead — ending, of course, on *Creep*:

![Downloadable Radiohead concert poster](https://raw.githubusercontent.com/allanninal/REPO/main/docs/poster-example.png)

## Code

{% embed https://github.com/allanninal/REPO %}

<!-- Replace REPO above with the actual repository name once pushed. -->

## How I Built It

**The stack is deliberately tiny — no API keys, no database, no secrets:**

- **Frontend:** React 19 + Vite, with hand-written CSS going for a real concert-poster look — bold Anton display type, stage-light gradients, self-hosted fonts.
- **Backend:** Node + Express. It proxies the [Deezer public API](https://developers.deezer.com/api) (no key required), runs the setlist-curation algorithm, and serves the built SPA — one container, one process.
- **Deploy:** Docker → **Google Cloud Run**, built straight from source with `gcloud run deploy --source .` (Cloud Build handles the image, so no local Docker needed).

**The fun part — turning "top tracks" into a believable concert.** A naive version just lists the hits by popularity, which feels nothing like a real show. So the algorithm splits the catalog into two buckets:

- **Hits** (Deezer's curated top tracks) drive the opener, main set, and encore.
- **Deep cuts** are pulled from the *studio albums'* lower-popularity band — but from around the 35th percentile down, so they're genuinely obscure without being filler like intros, reprises, or interludes (which get filtered out).

Then it shapes the arc:

- The single biggest song is always reserved for the **encore finale**.
- The main set gets **zig-zagged** — alternating higher- and lower-popularity songs — so the energy peaks and dips like a live show instead of monotonically fading out.

**Two technical gremlins worth mentioning:**

1. **CORS.** Deezer's API doesn't send CORS headers, so the browser can't call it directly — the Express backend proxies every request.
2. **Tainted canvas.** The downloadable poster is rasterised from an off-screen DOM node with `html-to-image`. The artist photo comes from Deezer's CDN (cross-origin), which would *taint the canvas* and silently break the export. Fixed with a small same-origin image proxy (`/api/img`) so the poster renders every time. I also self-hosted the fonts so `html-to-image` can embed them cleanly instead of choking on a cross-origin Google Fonts stylesheet.

The result is a little machine that manufactures the one thing every music obsessive has argued about at least once: *the perfect show.*

<!-- Thanks for participating! -->
