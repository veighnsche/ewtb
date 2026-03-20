import '@tanstack/react-start/server-only'

import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { Forecast } from '#/lib/wall-types'

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=3'
const WEATHER_TIMEOUT_MS = 5_000
const WEATHER_REFRESH_OK_MS = 10 * 60_000
const WEATHER_REFRESH_RETRY_MS = 60_000
const INITIAL_WEATHER_WAIT_MS = 250
const globalKey = '__ewtbWeatherCollectorState'

type WallWeatherState = {
  status: 'live' | 'loading' | 'error'
  forecast: Forecast[] | null
  updatedAt: string | null
  error: string | null
  stale: boolean
}

type WeatherCollectorState = {
  cache: WallWeatherState | null
  refreshPromise: Promise<WallWeatherState> | null
  started: boolean
}

export async function getWallWeatherData(): Promise<WallWeatherState> {
  const state = getCollectorState()
  startCollectorLoop(state)

  if (state.cache) {
    return state.cache
  }

  if (state.refreshPromise) {
    return waitForInitialRefresh(state.refreshPromise)
  }

  return buildLoadingState()
}

function getCollectorState(): WeatherCollectorState {
  const globalState = globalThis as typeof globalThis & {
    [globalKey]?: WeatherCollectorState
  }

  if (!globalState[globalKey]) {
    globalState[globalKey] = {
      cache: null,
      refreshPromise: null,
      started: false,
    }
  }

  return globalState[globalKey]
}

function startCollectorLoop(state: WeatherCollectorState) {
  if (state.started) {
    return
  }

  state.started = true

  const loop = async () => {
    const nextState = await refreshWeatherState(state)
    const delay = nextState.forecast && !nextState.stale ? WEATHER_REFRESH_OK_MS : WEATHER_REFRESH_RETRY_MS
    const timer = setTimeout(() => {
      void loop()
    }, delay)
    timer.unref?.()
  }

  void loop()
}

function buildLoadingState(): WallWeatherState {
  return {
    status: 'loading',
    forecast: null,
    updatedAt: null,
    error: null,
    stale: false,
  }
}

function buildErrorState(error: string, previous?: WallWeatherState | null): WallWeatherState {
  if (previous?.forecast) {
    return {
      ...previous,
      status: 'live',
      error,
      stale: true,
    }
  }

  return {
    status: 'error',
    forecast: null,
    updatedAt: previous?.updatedAt ?? new Date().toISOString(),
    error,
    stale: false,
  }
}

async function waitForInitialRefresh(refreshPromise: Promise<WallWeatherState>) {
  return new Promise<WallWeatherState>((resolve) => {
    const timer = setTimeout(() => {
      resolve(buildLoadingState())
    }, INITIAL_WEATHER_WAIT_MS)

    void refreshPromise.then((state) => {
      clearTimeout(timer)
      resolve(state)
    })
  })
}

async function refreshWeatherState(state: WeatherCollectorState): Promise<WallWeatherState> {
  if (state.refreshPromise) {
    return state.refreshPromise
  }

  state.refreshPromise = collectWeatherState()
    .then((result) => {
      state.cache = result
      return result
    })
    .catch((error) => {
      const fallback = buildErrorState(
        error instanceof Error ? error.message : 'Weather fetch failed',
        state.cache,
      )
      state.cache = fallback
      return fallback
    })
    .finally(() => {
      state.refreshPromise = null
    })

  return state.refreshPromise
}

async function collectWeatherState(): Promise<WallWeatherState> {
  return {
    status: 'live',
    forecast: await fetchLiveForecast(),
    updatedAt: new Date().toISOString(),
    error: null,
    stale: false,
  }
}

async function fetchLiveForecast(): Promise<Forecast[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS)

  try {
    const response = await fetch(WEATHER_URL, {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Weather request failed with ${response.status}`)
    }

    const weather = (await response.json()) as {
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
      }
    }

    const daily = weather.daily

    if (
      !daily?.time ||
      !daily.weather_code ||
      !daily.temperature_2m_max ||
      !daily.temperature_2m_min
    ) {
      throw new Error('Weather payload missing required daily fields')
    }

    return daily.time.map((day, index) => ({
      day:
        index === 0
          ? 'Vandaag'
          : format(parseISO(day), 'EEEE', {
              locale: nl,
            }),
      code: daily.weather_code?.[index] ?? 0,
      condition: weatherCodeLabel(daily.weather_code?.[index] ?? 0),
      high: `${Math.round(daily.temperature_2m_max?.[index] ?? 0)}°`,
      low: `${Math.round(daily.temperature_2m_min?.[index] ?? 0)}°`,
    }))
  } finally {
    clearTimeout(timeout)
  }
}

function weatherCodeLabel(code: number) {
  if (code === 0) return 'Helder'
  if (code === 1) return 'Vrij zonnig'
  if (code === 2) return 'Zon en wolken'
  if (code === 3) return 'Bewolkt'
  if (code === 45 || code === 48) return 'Mist'
  if (code >= 51 && code <= 55) return 'Motregen'
  if (code === 56 || code === 57) return 'IJzel'
  if (code >= 61 && code <= 67) return 'Regen'
  if (code >= 71 && code <= 77) return 'Sneeuw'
  if (code >= 80 && code <= 82) return 'Buien'
  if (code >= 85 && code <= 86) return 'Sneeuwbuien'
  if (code >= 95) return 'Onweer'

  return 'Wisselvallig'
}

export type { WallWeatherState }
