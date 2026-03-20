import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWallWeatherData } from './service'

const collectorStateKey = '__ewtbWeatherCollectorState'

function buildJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('getWallWeatherData', () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  it('returns a loading snapshot while the first refresh runs, then serves the cached forecast', async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))

      return buildJsonResponse({
        daily: {
          time: ['2026-03-19', '2026-03-20', '2026-03-21'],
          weather_code: [1, 3, 61],
          temperature_2m_max: [14.2, 12.6, 11.1],
          temperature_2m_min: [6.4, 5.1, 4.8],
        },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = await getWallWeatherData()

    expect(first).toMatchObject({
      status: 'loading',
      forecast: null,
      updatedAt: null,
      error: null,
      stale: false,
    })

    await new Promise((resolve) => setTimeout(resolve, 350))

    const second = await getWallWeatherData()

    expect(second.status).toBe('live')
    expect(second.stale).toBe(false)
    expect(second.forecast).toHaveLength(3)
    expect(second.forecast?.[0]).toMatchObject({
      day: 'Vandaag',
      condition: 'Vrij zonnig',
      high: '14°',
      low: '6°',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
