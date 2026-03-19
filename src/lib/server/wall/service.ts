import '@tanstack/react-start/server-only'

import { formatDistanceToNowStrict } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { HealthState, HostMetric, HostStatus } from '#/lib/wall-types'

type WallnodeSnapshot = {
  hostname: string
  role: string
  version: string
  lastSampleAt: string
  state: HealthState
  warnings: string[] | null
  uptimeSec: number | null
  load: {
    '1m': number | null
    '5m': number | null
    '15m': number | null
  }
  cpuPercent: number | null
  memPercent: number | null
  diskPercent: number | null
  cpuTempC: number | null
  cpuTempSeries: number[]
  degraded: boolean
  missing: string[] | null
}

type WallHostTarget = {
  id: string
  name: string
  baseUrl: string
  roleFallback: string
}

type WallCollectorResult = {
  generatedAt: string
  statusLabel: string
  connectionLabel: string
  cpuAggregatePercent: number
  cpuAggregateSeries: number[]
  hosts: HostStatus[]
}

type CollectedHost = {
  host: HostStatus
  reachable: boolean
  cpuPercent: number
}

type CollectorState = {
  cache: WallCollectorResult | null
  refreshPromise: Promise<WallCollectorResult> | null
  started: boolean
  cpuAggregateSeries: number[]
}

const SAMPLE_INTERVAL_MS = 5_000
const REQUEST_TIMEOUT_MS = 2_500
const CPU_AGGREGATE_HISTORY_POINTS = 120
const globalKey = '__ewtbWallCollectorState'

const defaultTargets: WallHostTarget[] = [
  { id: 'infra', name: 'infra', baseUrl: 'http://127.0.0.1:9580', roleFallback: 'wall-host' },
  { id: 'proto', name: 'proto', baseUrl: 'http://192.168.178.216:9580', roleFallback: 'wall-host' },
  { id: 'blep', name: 'blep', baseUrl: 'http://192.168.178.164:9580', roleFallback: 'wall-host' },
  { id: 'mac', name: 'mac', baseUrl: 'http://192.168.178.107:9580', roleFallback: 'wall-host' },
]

export async function getWallCollectorData(): Promise<WallCollectorResult> {
  const state = getCollectorState()
  startCollectorLoop(state)

  if (state.cache) {
    return state.cache
  }

  return refreshCollector(state)
}

function getCollectorState(): CollectorState {
  const globalState = globalThis as typeof globalThis & {
    [globalKey]?: CollectorState
  }

  if (!globalState[globalKey]) {
    globalState[globalKey] = {
      cache: null,
      refreshPromise: null,
      started: false,
      cpuAggregateSeries: [],
    }
  }

  return globalState[globalKey]
}

function startCollectorLoop(state: CollectorState) {
  if (state.started) {
    return
  }

  state.started = true

  void refreshCollector(state)

  const timer = setInterval(() => {
    void refreshCollector(state)
  }, SAMPLE_INTERVAL_MS)
  timer.unref?.()
}

async function refreshCollector(state: CollectorState): Promise<WallCollectorResult> {
  if (state.refreshPromise) {
    return state.refreshPromise
  }

  state.refreshPromise = collectWallData(state)
    .then((result) => {
      state.cache = result
      return result
    })
    .finally(() => {
      state.refreshPromise = null
    })

  return state.refreshPromise
}

async function collectWallData(state: CollectorState): Promise<WallCollectorResult> {
  const targets = getWallTargets()
  const results = await Promise.all(targets.map(fetchWallHost))
  const hosts = results.map((result) => result.host)
  const connectedHosts = results.filter((result) => result.reachable).length
  const cpuAggregatePercent = results.reduce((total, result) => total + result.cpuPercent, 0)
  const overallState = hosts.reduce<HealthState>((current, host) => {
    return severityRank(host.state) > severityRank(current) ? host.state : current
  }, 'healthy')
  const cpuAggregateSeries = pushHistoryPoint(state.cpuAggregateSeries, cpuAggregatePercent)

  return {
    generatedAt: `Bijgewerkt ${formatDistanceToNowStrict(new Date(), {
      addSuffix: true,
      locale: nl,
    })}`,
    statusLabel: overallState === 'healthy' ? 'Wall-feed normaal' : 'Wall-feed vraagt aandacht',
    connectionLabel: `${connectedHosts}/${hosts.length} hosts online`,
    cpuAggregatePercent,
    cpuAggregateSeries,
    hosts,
  }
}

function getWallTargets(): WallHostTarget[] {
  const raw = process.env.WALLNODE_TARGETS?.trim()
  if (!raw) {
    return defaultTargets
  }

  const targets = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [id, baseUrl, roleFallback] = item.split('|').map((value) => value.trim())
      if (!id || !baseUrl) {
        return null
      }
      return {
        id,
        name: id,
        baseUrl,
        roleFallback: roleFallback || 'wall-host',
      } satisfies WallHostTarget
    })
    .filter((target): target is WallHostTarget => target !== null)

  return targets.length > 0 ? targets : defaultTargets
}

async function fetchWallHost(target: WallHostTarget): Promise<CollectedHost> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${target.baseUrl}/metrics.json`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`status ${response.status}`)
    }

    const snapshot = (await response.json()) as WallnodeSnapshot
    return {
      host: mapSnapshotToHost(target, snapshot),
      reachable: true,
      cpuPercent: boundedPercent(snapshot.cpuPercent) ?? 0,
    }
  } catch (error) {
    return {
      host: buildUnavailableHost(target, error),
      reachable: false,
      cpuPercent: 0,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function mapSnapshotToHost(target: WallHostTarget, snapshot: WallnodeSnapshot): HostStatus {
  const cpuPercent = boundedPercent(snapshot.cpuPercent)
  const memPercent = boundedPercent(snapshot.memPercent)
  const diskPercent = boundedPercent(snapshot.diskPercent)
  const cpuTempC = snapshot.cpuTempC === null ? null : roundTemperature(snapshot.cpuTempC)

  const metrics: HostMetric[] = [
    buildMetric('CPU', cpuPercent),
    buildMetric('Geheugen', memPercent),
    buildMetric('Schijf', diskPercent),
  ].filter((metric): metric is HostMetric => metric !== null)

  return {
    id: target.id,
    name: snapshot.hostname || target.name,
    role: displayAddress(target, snapshot.role),
    state: snapshot.state,
    error: null,
    uptime: formatUptime(snapshot.uptimeSec),
    load: formatLoad(snapshot.load),
    cpuTempC,
    cpuTempSeries: snapshot.cpuTempSeries.map(roundTemperature),
    metrics,
  }
}

function buildUnavailableHost(target: WallHostTarget, error: unknown): HostStatus {
  return {
    id: target.id,
    name: target.name,
    role: displayAddress(target),
    state: 'critical',
    error: compactHostError(error),
    uptime: 'offline',
    load: 'n/a / n/a / n/a',
    cpuTempC: null,
    cpuTempSeries: [],
    metrics: [
      { label: 'CPU', value: 'offline', percent: 0, state: 'critical' },
      { label: 'Geheugen', value: 'offline', percent: 0, state: 'critical' },
      { label: 'Schijf', value: 'offline', percent: 0, state: 'critical' },
    ],
  }
}

function compactHostError(error: unknown) {
  const reason = error instanceof Error ? error.message : 'host unavailable'
  const lower = reason.toLowerCase()

  if (lower.includes('unable to connect') || lower.includes('fetch failed')) {
    return 'Geen verbinding met host'
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Host reageert niet op tijd'
  }

  if (lower.includes('status 4') || lower.includes('status 5')) {
    return 'Host gaf een foutstatus terug'
  }

  return 'Host niet bereikbaar'
}

function displayAddress(target: WallHostTarget, role?: string) {
  if (role && role !== 'wall-host') {
    return role
  }

  try {
    return new URL(target.baseUrl).hostname
  } catch {
    return target.name
  }
}

function pushHistoryPoint(series: number[], value: number) {
  const nextSeries = [...series, value]
  if (nextSeries.length <= CPU_AGGREGATE_HISTORY_POINTS) {
    return nextSeries
  }

  return nextSeries.slice(nextSeries.length - CPU_AGGREGATE_HISTORY_POINTS)
}

function buildMetric(label: string, percent: number | null) {
  if (percent === null) {
    return null
  }

  return {
    label,
    value: `${percent}%`,
    percent,
    state: metricState(percent),
  } satisfies HostMetric
}

function metricState(percent: number): HealthState {
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'warning'
  return 'healthy'
}

function formatUptime(uptimeSec: number | null) {
  if (uptimeSec === null || uptimeSec < 0) {
    return 'n/a'
  }

  const days = Math.floor(uptimeSec / 86_400)
  const hours = Math.floor((uptimeSec % 86_400) / 3_600)
  const minutes = Math.floor((uptimeSec % 3_600) / 60)

  if (days > 0) return `${days}d ${hours}u`
  if (hours > 0) return `${hours}u ${minutes}m`
  return `${minutes}m`
}

function formatLoad(load: WallnodeSnapshot['load']) {
  return [load['1m'], load['5m'], load['15m']]
    .map((value) => (value === null ? 'n/a' : value.toFixed(2).replace(/\.00$/, '')))
    .join(' / ')
}

function boundedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

function roundTemperature(value: number) {
  return Math.round(value * 10) / 10
}

function severityRank(state: HealthState) {
  switch (state) {
    case 'critical':
      return 2
    case 'warning':
      return 1
    case 'healthy':
      return 0
  }
}
