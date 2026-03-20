import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWallNewsFeedData } from './service'

const collectorStateKey = '__ewtbNewsCollectorState'

function buildJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function buildTextResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

describe('getWallNewsFeedData', () => {
  const originalApiBaseUrl = process.env.FRESHRSS_API_BASE_URL
  const originalUsername = process.env.FRESHRSS_USERNAME
  const originalApiPassword = process.env.FRESHRSS_API_PASSWORD

  beforeEach(() => {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
    process.env.FRESHRSS_API_BASE_URL = 'http://freshrss.test'
    process.env.FRESHRSS_USERNAME = 'vince'
    process.env.FRESHRSS_API_PASSWORD = 'secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    if (originalApiBaseUrl === undefined) {
      delete process.env.FRESHRSS_API_BASE_URL
    } else {
      process.env.FRESHRSS_API_BASE_URL = originalApiBaseUrl
    }

    if (originalUsername === undefined) {
      delete process.env.FRESHRSS_USERNAME
    } else {
      process.env.FRESHRSS_USERNAME = originalUsername
    }

    if (originalApiPassword === undefined) {
      delete process.env.FRESHRSS_API_PASSWORD
    } else {
      process.env.FRESHRSS_API_PASSWORD = originalApiPassword
    }

    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  it('returns a loading snapshot while the first refresh runs, then serves the cached feed', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.startsWith('http://freshrss.test/accounts/ClientLogin')) {
        return buildTextResponse('Auth=test-token')
      }

      if (url === 'http://freshrss.test/reader/api/0/subscription/list?output=json') {
        return buildJsonResponse({
          subscriptions: [{ id: 'feed/1', title: 'Feed 1', categories: [] }],
        })
      }

      if (
        url ===
        'http://freshrss.test/reader/api/0/stream/contents/feed%2F1?output=json&n=2'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 300))

        return buildJsonResponse({
          items: [
            {
              id: 'entry-1',
              title: 'Fresh headline',
              author: 'Feed author',
              published: 1_710_000_000,
              origin: {
                title: 'Feed 1',
                streamId: 'feed/1',
              },
              summary: {
                content: '<p>Short summary</p>',
              },
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = await getWallNewsFeedData()

    expect(first).toMatchObject({
      status: 'loading',
      updatedAt: null,
      items: [],
      error: null,
    })

    await new Promise((resolve) => setTimeout(resolve, 350))

    const second = await getWallNewsFeedData()

    expect(second.status).toBe('live')
    expect(second.items).toHaveLength(1)
    expect(second.items[0]).toMatchObject({
      id: 'entry-1',
      title: 'Fresh headline',
      source: 'Feed 1',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
