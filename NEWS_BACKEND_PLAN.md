# News Backend Plan

## Goal

Build a real news backend for the wall using FreshRSS as the upstream aggregator, while keeping the wall UI simple and stable.

The wall should not talk to RSS feeds directly, and it should not talk to FreshRSS directly from the browser.

## Recommended Architecture

Use this flow:

`feeds -> FreshRSS -> wall news normalizer -> wall UI`

Concretely:

1. FreshRSS collects and stores all subscribed feeds.
2. A small server-side layer fetches items from FreshRSS.
3. That layer normalizes, filters, and ranks the articles for the wall.
4. The wall UI reads only one local endpoint, for example:
   - `GET /api/wall/news`

## Why This Architecture

- keeps FreshRSS details out of the frontend
- keeps auth and feed access server-side
- avoids browser-side CORS and parsing complexity
- makes it easy to change source systems later
- lets the wall consume a small stable JSON shape
- gives room for ranking, deduplication, image extraction, and source weighting

## What The Wall Actually Needs

The wall does not need a generic feed reader.

It needs:

- a small number of high-signal items
- stable categories
- short readable titles
- one image per item when available
- predictable ordering
- no fake fallback news

## Proposed Server Responsibilities

The wall-side news backend should:

- fetch recent items from FreshRSS
- filter to the categories that matter
- deduplicate near-identical stories
- limit the number of items shown on the wall
- derive a wall-friendly title if the original title is too long
- choose an image:
  - article enclosure if available
  - `og:image` if available
  - local fallback image if nothing is available
- sort by recency plus source/category weighting
- expose normalized JSON to the wall

## Proposed API Shape

Example response from `GET /api/wall/news`:

```json
{
  "status": "ok",
  "updatedAt": "2026-03-18T22:15:00Z",
  "items": [
    {
      "id": "kernel-weekly-2026-03-18-1",
      "source": "Kernel Weekly",
      "category": "systemen",
      "title": "Kernel-patchset voor geheugentelling komt dichter bij merge",
      "age": "18m geleden",
      "imageSrc": "/news-images/kernel-weekly-2026-03-18-1.jpg",
      "url": "https://example.com/article"
    }
  ]
}
```

## Suggested Implementation In This Repo

Suggested files:

```text
src/lib/server/news/freshrss.ts
src/lib/server/news/normalize.ts
src/lib/server/news/images.ts
src/lib/server/news/cache.ts
src/routes/api/wall/news.ts
```

Suggested responsibilities:

- `freshrss.ts`
  - fetch data from FreshRSS
  - map raw FreshRSS payloads into an internal intermediate shape
- `normalize.ts`
  - deduplicate
  - categorize
  - trim titles
  - score/rank items
- `images.ts`
  - resolve article image
  - cache or proxy if needed later
- `cache.ts`
  - keep a short-lived server-side cache
- `news.ts`
  - expose the wall endpoint

## Caching Strategy

First version:

- server-side in-memory cache
- refresh every `5` minutes
- no client-side polling of FreshRSS

If FreshRSS is temporarily unavailable:

- return explicit backend status
- do not silently fabricate replacement stories

## Recommended News Inputs

Do not aim for generic tech news.

Use a curated set of high-signal feeds grouped by what actually matters for this wall.

### Core Categories

- `Systemen`
- `Distributies`
- `Infra`
- `Agents`
- `Web`
- `Beveiliging`

### Systems

Focus:

- Linux kernel
- systemd
- filesystems
- Wayland
- Mesa
- low-level desktop/system changes

Good source types:

- official engineering blogs
- weekly system digests
- release notes
- kernel-focused news summaries

### Distros And Packaging

Focus:

- Fedora
- Arch
- Debian
- Nix / NixOS
- Flatpak
- packaging and build workflows

Good source types:

- distro project news
- release feeds
- packaging engineering posts
- build and reproducibility updates

### Infra And Self-Hosting

Focus:

- reverse proxies
- storage
- observability
- local hosting
- backup tooling
- lightweight orchestration

Good source types:

- infrastructure blogs
- self-hosting project release feeds
- engineering posts from infra tools

### Agents And AI Tooling

Focus:

- model serving
- agent runtimes
- evals
- orchestration
- local-first AI infrastructure

Good source types:

- official engineering blogs
- release notes
- high-signal AI infra digests

### Web And UI Stack

Focus:

- browser engines
- React
- TanStack
- Vite
- TypeScript
- CSS platform changes

Good source types:

- release blogs
- platform status updates
- official framework blogs

### Security

Focus:

- distro advisories
- important package ecosystem issues
- severe infrastructure/security notices

Good source types:

- distro security advisories
- official security channels
- curated vulnerability summaries

## Recommended Category Weighting

For this wall, start with this rough priority:

- `40%` systems / Linux / infra
- `25%` agents / AI tooling
- `15%` distro / packaging
- `10%` web platform / UI stack
- `10%` security

## Things To Avoid

Avoid these input types:

- generic startup media
- mainstream gadget news
- clickbait dev media
- repetitive syndication feeds
- general AI hype coverage
- social feeds as the primary source

## Practical Feed Strategy

Start small:

- `20-30` feeds total
- roughly `3-5` strong feeds per category

Prefer:

- fewer, high-signal feeds

Avoid:

- too many overlapping sources

## Wall-Specific Constraints

The wall is not a reading interface. It is a glance interface.

That means:

- not too many total stories
- clear categories
- large readable titles
- stable pagination
- predictable image behavior

## Recommendation For The Current UI

Keep the current news panel as a paged view:

- `4` items per page
- automatic page rotation
- no scroll

The backend should therefore ideally cap the wall feed to a modest number of items, for example:

- `8`
- `12`
- or `16`

Even though the UI can technically handle more pages, too many pages reduce the wall’s usefulness.

## Next Build Steps

1. Set up FreshRSS and subscribe to the initial curated feed list.
2. Add a server-side FreshRSS client in this repo.
3. Build a normalized `/api/wall/news` endpoint.
4. Replace mock news in the wall with real data from that endpoint.
5. Add image resolution and safe fallbacks.
6. Add ranking and per-category caps.

## Decision Summary

- Upstream aggregator: `FreshRSS`
- Wall should not fetch feeds directly: `yes`
- Wall should not talk to FreshRSS directly from browser: `yes`
- Add a server-side normalization layer: `yes`
- Keep the wall feed curated and limited: `yes`
