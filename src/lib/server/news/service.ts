import '@tanstack/react-start/server-only'

import { format, formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { mockWallData, type Headline } from '#/lib/mock-wall-data'

type FreshRssConfig = {
  apiBaseUrl: string
  username: string
  apiPassword: string
}

type WallNewsFeed = {
  status: 'live' | 'mock' | 'error'
  updatedAt: string
  source: 'freshrss' | 'mock'
  error: string | null
  items: Headline[]
}

type FreshRssStreamResponse = {
  items?: FreshRssEntry[]
}

type FreshRssSubscriptionListResponse = {
  subscriptions?: FreshRssSubscription[]
}

type FreshRssSubscription = {
  id?: string
  title?: string
  url?: string
  categories?: Array<{
    id?: string
    label?: string
  }>
}

type FreshRssEntry = {
  id?: string
  title?: string
  author?: string
  published?: number
  updated?: number
  categories?: string[]
  alternate?: Array<{ href?: string }>
  canonical?: Array<{ href?: string }>
  origin?: {
    title?: string
    streamId?: string
    htmlUrl?: string
  }
  summary?: {
    content?: string
  }
  content?: {
    content?: string
  }
  visual?: {
    url?: string
  }
  enclosure?: Array<{ href?: string; type?: string }>
}

const DEFAULT_NEWS_LIMIT = 140
const PER_FEED_FETCH_LIMIT = 2
const DEFAULT_CATEGORY = 'algemeen'
const DEFAULT_LANGUAGE = 'EN'

export async function getWallNewsFeedData(): Promise<WallNewsFeed> {
  const config = getFreshRssConfig()

  if (!config) {
    return buildMockFeed('FreshRSS-config ontbreekt')
  }

  try {
    const authToken = await loginToFreshRss(config)
    const entries = await fetchFreshRssBalancedEntries(config, authToken, DEFAULT_NEWS_LIMIT)

    return {
      status: 'live',
      updatedAt: new Date().toISOString(),
      source: 'freshrss',
      error: null,
      items: normalizeFreshRssEntries(entries),
    }
  } catch (error) {
    return buildMockFeed(error instanceof Error ? error.message : 'FreshRSS ophalen mislukt')
  }
}

function getFreshRssConfig(): FreshRssConfig | null {
  const apiBaseUrl = process.env.FRESHRSS_API_BASE_URL?.trim()
  const username = process.env.FRESHRSS_USERNAME?.trim()
  const apiPassword = process.env.FRESHRSS_API_PASSWORD?.trim()

  if (!apiBaseUrl || !username || !apiPassword) {
    return null
  }

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    username,
    apiPassword,
  }
}

async function loginToFreshRss(config: FreshRssConfig) {
  const url = new URL(`${config.apiBaseUrl}/accounts/ClientLogin`)
  url.searchParams.set('Email', config.username)
  url.searchParams.set('Passwd', config.apiPassword)

  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    throw new Error(`FreshRSS login faalde met status ${response.status}`)
  }

  const body = await response.text()
  const authLine = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Auth='))

  if (!authLine) {
    throw new Error('FreshRSS login gaf geen auth token terug')
  }

  return authLine.slice('Auth='.length)
}

async function fetchFreshRssSubscriptions(config: FreshRssConfig, authToken: string) {
  const url = new URL(`${config.apiBaseUrl}/reader/api/0/subscription/list`)
  url.searchParams.set('output', 'json')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `GoogleLogin auth=${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`FreshRSS subscription list faalde met status ${response.status}`)
  }

  const payload = (await response.json()) as FreshRssSubscriptionListResponse

  return payload.subscriptions ?? []
}

async function fetchFreshRssStreamContents(
  config: FreshRssConfig,
  authToken: string,
  streamId: string,
  limit: number,
) {
  const url = new URL(
    `${config.apiBaseUrl}/reader/api/0/stream/contents/${encodeURIComponent(streamId)}`,
  )
  url.searchParams.set('output', 'json')
  url.searchParams.set('n', String(limit))

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `GoogleLogin auth=${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`FreshRSS stream ${streamId} faalde met status ${response.status}`)
  }

  const payload = (await response.json()) as FreshRssStreamResponse

  return payload.items ?? []
}

async function fetchFreshRssBalancedEntries(
  config: FreshRssConfig,
  authToken: string,
  limit: number,
) {
  const subscriptions = await fetchFreshRssSubscriptions(config, authToken)
  const liveSubscriptions = subscriptions.filter((subscription) => subscription.id)

  const settled = await Promise.allSettled(
    liveSubscriptions.map(async (subscription) => {
      const entries = await fetchFreshRssStreamContents(
        config,
        authToken,
        subscription.id!,
        PER_FEED_FETCH_LIMIT,
      )

      return {
        subscription,
        entries,
      }
    }),
  )

  const primaryEntries: Array<{ entry: FreshRssEntry; subscription: FreshRssSubscription }> = []
  const secondaryEntries: Array<{ entry: FreshRssEntry; subscription: FreshRssSubscription }> = []

  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      continue
    }

    const [first, ...rest] = result.value.entries

    if (first) {
      primaryEntries.push({ entry: first, subscription: result.value.subscription })
    }

    for (const entry of rest) {
      secondaryEntries.push({ entry, subscription: result.value.subscription })
    }
  }

  return [...primaryEntries, ...secondaryEntries].slice(0, Math.max(limit * 2, limit))
}

function normalizeFreshRssEntries(
  entries: Array<{ entry: FreshRssEntry; subscription: FreshRssSubscription }>,
): Headline[] {
  const items = entries
    .map(({ entry, subscription }, index) => normalizeFreshRssEntry(entry, subscription, index))
    .filter((entry): entry is Headline => entry !== null)
    .sort((left, right) => sortHeadlines(right, left))
    .slice(0, DEFAULT_NEWS_LIMIT)

  if (items.length > 0) {
    return items
  }

  return mockWallData.headlines.slice(0, DEFAULT_NEWS_LIMIT)
}

function normalizeFreshRssEntry(
  entry: FreshRssEntry,
  subscription: FreshRssSubscription,
  index: number,
): Headline | null {
  const title = entry.title?.trim()

  if (!title) {
    return null
  }

  const publishedAt = entry.published ? new Date(entry.published * 1000) : new Date()
  const category = classifyCategory(entry, subscription)
  const priority = classifyPriority(category, publishedAt)
  const source = entry.origin?.title?.trim() || subscription.title?.trim() || 'Onbekende bron'
  const summaryHtml = entry.summary?.content ?? entry.content?.content ?? ''
  const summary = cleanSummary(summaryHtml)
  const url = pickEntryUrl(entry)

  return {
    id: entry.id?.trim() || `fresh-${index}-${publishedAt.getTime()}`,
    source,
    category,
    title,
    summary,
    author: entry.author?.trim() || source,
    language: DEFAULT_LANGUAGE,
    priority,
    publishedAt: format(publishedAt, 'yyyy-MM-dd HH:mm'),
    age: formatDistanceToNow(publishedAt, { addSuffix: true, locale: nl }),
    url,
    imageSrc: pickEntryImage(entry, category),
  }
}

function classifyCategory(entry: FreshRssEntry, subscription: FreshRssSubscription) {
  const explicitLabel = extractSubscriptionLabel(subscription)

  if (explicitLabel) {
    return explicitLabel
  }

  const categoryText = [
    ...(entry.categories ?? []),
    ...(subscription.categories?.map((category) => category.label ?? category.id ?? '') ?? []),
    entry.origin?.streamId ?? '',
    entry.origin?.title ?? '',
    subscription.title ?? '',
    entry.title ?? '',
  ]
    .join(' ')
    .toLowerCase()

  if (includesAny(categoryText, ['world', 'international', 'geopolit', 'europa', 'midden-oosten', 'china', 'russia', 'ukraine'])) {
    return 'wereld'
  }

  if (includesAny(categoryText, ['security', 'cve', 'advisory', 'vulnerability', 'beveilig'])) {
    return 'beveiliging'
  }

  if (includesAny(categoryText, ['agent', 'llm', 'model', 'ai', 'inference'])) {
    return 'agents'
  }

  if (includesAny(categoryText, ['infra', 'observability', 'self-host', 'monitor', 'hosting'])) {
    return 'infrastructuur'
  }

  if (includesAny(categoryText, ['fedora', 'debian', 'arch', 'nix', 'flatpak', 'package', 'distro'])) {
    return 'distributies'
  }

  if (includesAny(categoryText, ['browser', 'react', 'typescript', 'vite', 'css', 'web'])) {
    return 'web'
  }

  if (includesAny(categoryText, ['kernel', 'linux', 'systemd', 'mesa', 'wayland', 'filesystem'])) {
    return 'systemen'
  }

  return DEFAULT_CATEGORY
}

function extractSubscriptionLabel(subscription: FreshRssSubscription) {
  const rawLabel = subscription.categories
    ?.map((category) => category.label?.trim() || category.id?.split('/label/')[1]?.trim() || '')
    .find((label) => label && label.toLowerCase() !== 'uncategorized')

  if (!rawLabel) {
    return null
  }

  const label = rawLabel.toLowerCase()

  if (label === 'systemen') return 'systemen'
  if (label === 'distributies') return 'distributies'
  if (label === 'infra' || label === 'infrastructuur') return 'infrastructuur'
  if (label === 'agents') return 'agents'
  if (label === 'web') return 'web'
  if (label === 'beveiliging') return 'beveiliging'
  if (label === 'wereld' || label === 'internationaal') return 'wereld'

  return null
}

function classifyPriority(category: string, publishedAt: Date): Headline['priority'] {
  const ageInHours = Math.abs(Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)

  if (category === 'beveiliging') return 'hoog'
  if (category === 'systemen' && ageInHours < 8) return 'hoog'
  if (category === 'agents' && ageInHours < 12) return 'hoog'
  if (ageInHours < 24) return 'normaal'

  return 'laag'
}

function pickEntryUrl(entry: FreshRssEntry) {
  return (
    entry.alternate?.find((link) => link.href)?.href ||
    entry.canonical?.find((link) => link.href)?.href ||
    entry.origin?.htmlUrl ||
    'https://example.com/'
  )
}

function pickEntryImage(entry: FreshRssEntry, category: string) {
  const visualUrl = entry.visual?.url?.trim()

  if (visualUrl) {
    return visualUrl
  }

  const enclosureImage = entry.enclosure?.find((file) => file.type?.startsWith('image/') && file.href)?.href

  if (enclosureImage) {
    return enclosureImage
  }

  const summaryHtml = entry.summary?.content ?? entry.content?.content ?? ''
  const summaryImage = extractFirstImage(summaryHtml)

  if (summaryImage) {
    return summaryImage
  }

  return null
}

function cleanSummary(html: string) {
  const text = html
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return 'Geen samenvatting beschikbaar.'
  }

  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}...` : text
}

function extractFirstImage(html: string) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)

  return match?.[1] ?? null
}

function sortHeadlines(left: Headline, right: Headline) {
  const leftDate = Date.parse(left.publishedAt.replace(' ', 'T'))
  const rightDate = Date.parse(right.publishedAt.replace(' ', 'T'))

  return leftDate - rightDate
}

function includesAny(input: string, needles: string[]) {
  return needles.some((needle) => input.includes(needle))
}

function buildMockFeed(error: string): WallNewsFeed {
  return {
    status: 'mock',
    updatedAt: new Date().toISOString(),
    source: 'mock',
    error,
    items: mockWallData.headlines.slice(0, DEFAULT_NEWS_LIMIT),
  }
}

export type { WallNewsFeed }
