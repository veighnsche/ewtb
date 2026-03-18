import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWallCollectorData } from './service'

const collectorStateKey = '__ewtbWallCollectorState'

function buildResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('getWallCollectorData', () => {
  const originalTargets = process.env.WALLNODE_TARGETS

  beforeEach(() => {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    if (originalTargets === undefined) {
      delete process.env.WALLNODE_TARGETS
    } else {
      process.env.WALLNODE_TARGETS = originalTargets
    }

    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  it('aggregates live host data and marks unreachable hosts offline', async () => {
    process.env.WALLNODE_TARGETS =
      'alpha|http://alpha.test:9580|wall-host,beta|http://beta.test:9580|wall-host'

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url === 'http://alpha.test:9580/metrics.json') {
        return buildResponse({
          hostname: 'alpha',
          role: 'builder',
          version: '0.1.0',
          lastSampleAt: '2026-03-18T22:00:00Z',
          state: 'healthy',
          warnings: [],
          uptimeSec: 7200,
          load: { '1m': 0.25, '5m': 0.5, '15m': 0.75 },
          cpuPercent: 12,
          memPercent: 43,
          diskPercent: 66,
          cpuTempC: 51.37,
          cpuTempSeries: [49.1, 50.5, 51.37],
          degraded: false,
          missing: [],
        })
      }

      throw new Error('connect ECONNREFUSED')
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await getWallCollectorData()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.connectionLabel).toBe('1/2 hosts online')
    expect(result.statusLabel).toBe('Wall-feed vraagt aandacht')
    expect(result.cpuAggregatePercent).toBe(12)
    expect(result.cpuAggregateSeries).toEqual([12])
    expect(result.hosts).toHaveLength(2)
    expect(result.hosts[0]).toMatchObject({
      id: 'alpha',
      name: 'alpha',
      role: 'builder',
      state: 'healthy',
      uptime: '2u 0m',
      load: '0.25 / 0.50 / 0.75',
      cpuTempC: 51.4,
    })
    expect(result.hosts[0].metrics).toEqual([
      { label: 'CPU', value: '12%', percent: 12, state: 'healthy' },
      { label: 'Geheugen', value: '43%', percent: 43, state: 'healthy' },
      { label: 'Schijf', value: '66%', percent: 66, state: 'healthy' },
    ])
    expect(result.hosts[1]).toMatchObject({
      id: 'beta',
      name: 'beta',
      role: 'beta.test',
      state: 'critical',
      uptime: 'offline',
      load: 'n/a / n/a / n/a',
      cpuTempC: null,
    })
    expect(result.hosts[1].metrics[0]).toMatchObject({
      label: 'CPU',
      value: 'offline',
      state: 'critical',
    })
  })
})
