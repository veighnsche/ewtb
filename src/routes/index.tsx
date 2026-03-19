import {
  addDays,
  eachDayOfInterval,
  format,
  formatISO,
  isBefore,
  isSameDay,
  isSameMonth,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { Clock3, Cpu, Newspaper, Rows3, SunMedium } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import type { IconType } from 'react-icons'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import {
  WiCloud,
  WiCloudy,
  WiDayCloudy,
  WiDayCloudyGusts,
  WiDaySunny,
  WiFog,
  WiHail,
  WiRain,
  WiShowers,
  WiSnow,
  WiSleet,
  WiThunderstorm,
  WiSprinkle,
} from 'react-icons/wi'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import { Separator } from '#/components/ui/separator'
import {
  type AgendaItem,
  type ClockCard,
  type Forecast,
  type HealthState,
  type Headline,
  type HostMetric,
  type HostStatus,
} from '#/lib/wall-types'
import { getWallAgenda } from '#/lib/server/agenda'
import { getWallNewsFeed } from '#/lib/server/news'
import { getWallCollector } from '#/lib/server/wall'

type LiveWidgets = {
  wall: Awaited<ReturnType<typeof getWallCollector>>
  agenda: Awaited<ReturnType<typeof getWallAgenda>>
  clocks: ClockCard[]
  weather: WeatherState
  newsFeed: Awaited<ReturnType<typeof getWallNewsFeed>>
}

type WeatherState = {
  forecast: Forecast[] | null
  updatedAt: string | null
  error: string | null
  stale: boolean
}

const CLOCKS = [
  { label: 'Parijs', timeZone: 'Europe/Paris' },
  { label: 'Palo Alto', timeZone: 'America/Los_Angeles' },
  { label: 'Shenzhen', timeZone: 'Asia/Shanghai' },
] as const

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=3'
const NEWS_PAGE_SIZE = 7
const NEWS_PAGE_INTERVAL_MS = 12_000
const WALL_REFRESH_MS = 5_000
const WEATHER_TIMEOUT_MS = 5_000
const WEATHER_REFRESH_OK_MS = 10 * 60_000
const WEATHER_REFRESH_RETRY_MS = 60_000

export const Route = createFileRoute('/')({
  loader: async () => getLiveWidgets(),
  component: App,
})

function healthStateLabel(state: HealthState) {
  switch (state) {
    case 'healthy':
      return 'ok'
    case 'warning':
      return 'waarschuwing'
    case 'critical':
      return 'kritiek'
  }
}

function toneClasses(state: HealthState) {
  switch (state) {
    case 'healthy':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'critical':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  }
}

function App() {
  const liveWidgets = Route.useLoaderData()
  const [wall, setWall] = useState(liveWidgets.wall)
  const [agenda, setAgenda] = useState(liveWidgets.agenda)
  const [clocks, setClocks] = useState(liveWidgets.clocks)
  const [weather, setWeather] = useState(liveWidgets.weather)
  const [newsFeed, setNewsFeed] = useState(liveWidgets.newsFeed)
  const fetchAgenda = useServerFn(getWallAgenda)
  const fetchNewsFeed = useServerFn(getWallNewsFeed)
  const fetchWall = useServerFn(getWallCollector)

  useEffect(() => {
    const updateClocks = () => {
      startTransition(() => {
        setClocks(buildClockCards(new Date()))
      })
    }

    updateClocks()

    const clockTimer = window.setInterval(updateClocks, 30_000)
    let weatherTimer: number | null = null
    let latestWeather = liveWidgets.weather
    const scheduleWeatherRefresh = (delay: number) => {
      weatherTimer = window.setTimeout(async () => {
        const nextWeather = await fetchWeatherState(latestWeather)

        latestWeather = nextWeather

        startTransition(() => {
          setWeather(nextWeather)
        })

        scheduleWeatherRefresh(
          nextWeather.forecast && !nextWeather.stale
            ? WEATHER_REFRESH_OK_MS
            : WEATHER_REFRESH_RETRY_MS,
        )
      }, delay)
    }
    scheduleWeatherRefresh(
      latestWeather.forecast && !latestWeather.stale
        ? WEATHER_REFRESH_OK_MS
        : WEATHER_REFRESH_RETRY_MS,
    )
    const newsTimer = window.setInterval(async () => {
      const nextNewsFeed = await fetchNewsFeed()

      startTransition(() => {
        setNewsFeed(nextNewsFeed)
      })
    }, 5 * 60_000)
    const agendaTimer = window.setInterval(async () => {
      const nextAgenda = await fetchAgenda()

      startTransition(() => {
        setAgenda(nextAgenda)
      })
    }, 60_000)
    const wallTimer = window.setInterval(async () => {
      const nextWall = await fetchWall()

      startTransition(() => {
        setWall(nextWall)
      })
    }, WALL_REFRESH_MS)

    return () => {
      window.clearInterval(clockTimer)
      if (weatherTimer !== null) {
        window.clearTimeout(weatherTimer)
      }
      window.clearInterval(newsTimer)
      window.clearInterval(agendaTimer)
      window.clearInterval(wallTimer)
    }
  }, [fetchAgenda, fetchNewsFeed, fetchWall, liveWidgets.weather])

  return (
    <main className="h-[100svh] w-screen overflow-hidden px-6 py-5 2xl:px-8 2xl:py-6">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
        <header className="grid grid-cols-[0.95fr_1.35fr_0.9fr] items-stretch gap-4">
          <div className="space-y-3">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Event wall
            </p>
            <div className="space-y-2">
              <h1 className="m-0 text-5xl font-semibold tracking-tight 2xl:text-6xl">
                Statusoverzicht
              </h1>
              <p className="m-0 text-xl text-muted-foreground 2xl:text-2xl">
                {wall.generatedAt}
              </p>
            </div>
          </div>
          <CalendarPanel agenda={agenda} />
          <div className="grid grid-cols-2 gap-3">
            <WallChip icon={<Rows3 className="size-4" />} label={wall.statusLabel} />
            <WallChip icon={<Cpu className="size-4" />} label={wall.connectionLabel} />
            <WallChip
              icon={<Newspaper className="size-4" />}
              label={
                newsFeed.status === 'live'
                  ? `${newsFeed.items.length} live koppen`
                  : 'nieuws fout'
              }
            />
            <WallChip
              icon={<SunMedium className="size-4" />}
              label={
                weather.forecast
                  ? `${weather.forecast.length} dagen vooruitzicht${weather.stale ? ' • verouderd' : ''}`
                  : 'weer offline'
              }
            />
          </div>
        </header>

        <section className="grid min-h-0 grid-cols-[0.95fr_1.2fr_1fr] gap-4">
          <HostsPanel hosts={wall.hosts} />
          <NewsPanel headlines={newsFeed.items} status={newsFeed.status} error={newsFeed.error} />
          <RightRail
            agenda={agenda}
            weather={weather}
            clocks={clocks}
          />
        </section>
      </div>
    </main>
  )
}

function CalendarPanel({ agenda }: { agenda: LiveWidgets['agenda'] }) {
  const days = buildWallCalendar(new Date())
  const agendaDates = new Set(agenda.items.map((item) => item.dateIso))

  return (
    <div className="grid grid-cols-14 gap-x-2 gap-y-3 self-center px-2">
      {days.map((day, index) => (
        <div
          key={day.iso}
          className={[
            'relative text-center',
            day.isToday ? 'text-primary' : '',
            day.isWeekend ? 'text-muted-foreground/70' : '',
            day.isPastMonth && index < 14 ? 'opacity-50' : '',
            day.isNextMonth && index >= 42 ? 'opacity-50' : '',
          ].join(' ')}
        >
          <p className="m-0 text-2xl font-semibold leading-none 2xl:text-3xl">
            {day.day}
          </p>
          {agendaDates.has(day.iso) ? (
            <div className="pointer-events-none absolute left-1/2 top-[calc(100%-0.1rem)] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-sky-400/90" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function WallChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-lg font-medium 2xl:text-xl">
      <div className="text-muted-foreground">{icon}</div>
      <span>{label}</span>
    </div>
  )
}

function HostsPanel({
  hosts,
}: {
  hosts: HostStatus[]
}) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-3xl 2xl:text-4xl">Systeemstatus</CardTitle>
        <CardDescription className="text-lg 2xl:text-xl">
          Overzicht van de systemen. De agenda blijft de hoofdzaak.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 px-6 pb-5">
        <div className="grid min-h-0 grid-cols-2 gap-4">
          {hosts.map((host) => (
            <div key={host.id} className="rounded-lg border p-4">
              <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-xl font-medium 2xl:text-2xl">{host.name}</p>
                  <p className="m-0 truncate text-sm text-muted-foreground 2xl:text-base">{host.role}</p>
                  {host.error ? (
                    <p className="m-0 mt-1 truncate text-xs text-rose-300 2xl:text-sm">{host.error}</p>
                  ) : null}
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-sm 2xl:text-base ${toneClasses(host.state)}`}
                >
                  {healthStateLabel(host.state)}
                </Badge>
              </div>
              <div className="mb-4 grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] gap-2 text-sm 2xl:text-base">
                <StatBlock label="Uptime" value={host.uptime} />
                {splitLoadValues(host.load).map((value, index) => (
                  <StatBlock
                    key={`${host.id}-load-${index + 1}`}
                    label={LOAD_WINDOWS[index]}
                    value={value}
                    mono
                  />
                ))}
              </div>
              <HostTemperatureChart host={host} />
              <div className="space-y-4">
                {host.metrics.map((metric) => (
                  <MetricRow key={`${host.id}-${metric.label}`} metric={metric} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const LOAD_WINDOWS = ['1m', '5m', '15m'] as const

function splitLoadValues(load: string) {
  return load.split('/').map((value) => value.trim())
}

function StatBlock({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-muted-foreground 2xl:text-xs">
        {label}
      </p>
      <p
        className={[
          'mt-1 mb-0 whitespace-nowrap font-medium text-sm 2xl:text-base',
          mono ? 'font-mono' : '',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function MetricRow({ metric }: { metric: HostMetric }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-base 2xl:text-lg">
        <span className="text-muted-foreground">{metric.label}</span>
        <span className="font-medium">{metric.value}</span>
      </div>
      <Progress value={metric.percent} className="h-3" />
    </div>
  )
}

function HostTemperatureChart({ host }: { host: HostStatus }) {
  const data = host.cpuTempSeries.map((value, index) => ({
    index,
    value,
  }))
  const stroke = temperatureStroke(host.state)

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-end justify-between">
        <p className="m-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground 2xl:text-xs">
          CPU temperatuur
        </p>
        <p className="m-0 font-mono text-lg font-medium 2xl:text-xl">
          {host.cpuTempC === null ? 'n/a' : `${host.cpuTempC}°C`}
        </p>
      </div>
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
            <YAxis domain={['dataMin - 4', 'dataMax + 4']} hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AgendaPanel({
  agenda,
  status,
  error,
}: {
  agenda: AgendaItem[]
  status: LiveWidgets['agenda']['status']
  error: string | null
}) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-2xl 2xl:text-3xl">Agenda</CardTitle>
        <CardDescription className="text-base 2xl:text-lg">
          Eerstvolgende dingen op tijdvolgorde.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-4 px-6 pb-5">
        {status === 'error' ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
            <p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">Agenda niet beschikbaar</p>
            <p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
              {error ?? 'Geen live agenda-data beschikbaar.'}
            </p>
          </div>
        ) : (
          agenda.map((item) => (
            <div key={item.id} className="rounded-lg border p-5">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <p className="m-0 min-w-0 text-xs uppercase tracking-[0.18em] text-muted-foreground 2xl:text-sm">
                  {item.dateLabel}
                </p>
                <p className="m-0 shrink-0 text-xl font-semibold tracking-tight 2xl:text-2xl">
                  {item.time}
                </p>
              </div>
              <div className="space-y-2">
                <p className="m-0 text-xl font-medium leading-tight text-balance 2xl:text-2xl">
                  {item.title}
                </p>
                <p className="m-0 text-sm leading-6 text-muted-foreground 2xl:text-base">
                  {item.context}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function NewsPanel({
  headlines,
  status,
  error,
}: {
  headlines: Headline[]
  status: LiveWidgets['newsFeed']['status']
  error: string | null
}) {
  const pages = chunkHeadlines(headlines, NEWS_PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    setPageIndex(0)
  }, [headlines.length])

  useEffect(() => {
    if (pages.length <= 1) return

    const timer = window.setInterval(() => {
      startTransition(() => {
        setPageIndex((current) => (current + 1) % pages.length)
      })
    }, NEWS_PAGE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [pages.length])

  const visibleHeadlines = pages[pageIndex] ?? []

  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl 2xl:text-3xl">Nieuws</CardTitle>
            <CardDescription className="text-base 2xl:text-lg">
              {status === 'live'
                ? 'Live uit FreshRSS. Kort, scanbaar en ondergeschikt aan de agenda.'
                : 'Geen live nieuws beschikbaar.'}
            </CardDescription>
          </div>
          {pages.length > 1 ? (
            <div className="pt-1 text-sm tabular-nums text-muted-foreground 2xl:text-base">
              {pageIndex + 1} / {pages.length}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-3 px-5 pb-5">
        {status === 'error' ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
            <p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">Nieuws niet beschikbaar</p>
            <p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
              {error ?? 'FreshRSS gaf geen live nieuws terug.'}
            </p>
          </div>
        ) : (
          visibleHeadlines.map((headline) => (
            <div
              key={headline.id}
              className={[
                'gap-4 rounded-lg border p-4',
                headline.imageSrc
                  ? 'grid grid-cols-[7.5rem_minmax(0,1fr)] 2xl:grid-cols-[8rem_minmax(0,1fr)]'
                  : 'block',
              ].join(' ')}
            >
              {headline.imageSrc ? (
                <img
                  src={headline.imageSrc}
                  alt=""
                  className="h-20 w-30 rounded-md object-cover 2xl:h-24 2xl:w-32"
                />
              ) : null}
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs 2xl:text-sm">{headline.source}</Badge>
                  <Badge variant="outline" className="text-xs 2xl:text-sm">{headline.category}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs 2xl:text-sm ${newsPriorityTone(headline.priority)}`}
                  >
                    {headline.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground 2xl:text-sm">{headline.age}</span>
                </div>
                <p className="m-0 line-clamp-2 text-xl font-medium leading-tight 2xl:text-2xl">
                  {headline.title}
                </p>
                <p className="m-0 line-clamp-2 text-sm leading-6 text-muted-foreground 2xl:text-base">
                  {headline.summary}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function RightRail({
  agenda,
  weather,
  clocks,
}: {
  agenda: LiveWidgets['agenda']
  weather: WeatherState
  clocks: ClockCard[]
}) {
  return (
    <div className="grid min-h-0 grid-rows-[1.1fr_auto] gap-4">
      <AgendaPanel agenda={agenda.items} status={agenda.status} error={agenda.error} />

      <div className="grid grid-cols-2 gap-4">
        <Card className="py-0">
          <CardHeader className="px-5 pt-4">
            <CardTitle className="text-2xl 2xl:text-3xl">Klokken</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5">
            {clocks.map((clock) => (
              <div key={clock.label} className="flex items-center justify-between rounded-lg border px-4 py-4">
                <div>
                  <p className="m-0 text-base font-medium 2xl:text-xl">{clock.label}</p>
                  <p className="m-0 text-sm text-muted-foreground 2xl:text-base">{clock.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <span className="text-3xl font-semibold tracking-tight 2xl:text-4xl">{clock.time}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="px-5 pt-4">
            <CardTitle className="text-2xl 2xl:text-3xl">Weer</CardTitle>
            {weather.stale && weather.forecast ? (
              <CardDescription className="text-sm 2xl:text-base">
                Tijdelijk verouderd. Laatste geldige data blijft zichtbaar.
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5">
            {weather.forecast ? (
              weather.forecast.map((item) => (
                <div key={item.day} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted/35 text-4xl text-primary 2xl:size-14 2xl:text-5xl">
                      {(() => {
                        const WeatherIcon = weatherCodeIcon(item.code ?? 3)

                        return <WeatherIcon />
                      })()}
                    </div>
                    <div>
                      <p className="m-0 text-lg font-medium 2xl:text-xl">{item.day}</p>
                      <p className="m-0 text-sm text-muted-foreground 2xl:text-base">{item.condition}</p>
                    </div>
                  </div>
                  <p className="m-0 text-xl font-semibold 2xl:text-2xl">
                    {item.high} / {item.low}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4">
                <p className="m-0 text-lg font-medium text-amber-300 2xl:text-xl">Weerdata niet beschikbaar</p>
                <p className="m-0 mt-2 text-sm text-amber-200/80 2xl:text-base">
                  {weather.error ?? 'Geen verbinding met de weerbron.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildWallCalendar(referenceDate: Date) {
  const firstOfMonth = startOfMonth(referenceDate)
  const start = startOfWeek(firstOfMonth, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end: addDays(start, 55) })

  return days.map((current) => {
    return {
      iso: formatISO(current, { representation: 'date' }),
      day: format(current, 'd'),
      isWeekend: isWeekend(current),
      isToday: isSameDay(current, referenceDate),
      isPastMonth: !isSameMonth(current, referenceDate) && isBefore(current, referenceDate),
      isNextMonth: !isSameMonth(current, referenceDate) && !isBefore(current, referenceDate),
    }
  })
}

async function getLiveWidgets(): Promise<LiveWidgets> {
  const now = new Date()

  return {
    wall: await getWallCollector(),
    agenda: await getWallAgenda(),
    clocks: buildClockCards(now),
    weather: await fetchWeatherState(),
    newsFeed: await getWallNewsFeed(),
  }
}

function buildClockCards(now: Date) {
  return CLOCKS.map((clock) => ({
    label: clock.label,
    time: new Intl.DateTimeFormat('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: clock.timeZone,
    }).format(now),
    date: new Intl.DateTimeFormat('nl-NL', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: clock.timeZone,
    })
      .format(now)
      .replaceAll('.', ''),
  }))
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

async function fetchWeatherState(previous?: WeatherState): Promise<WeatherState> {
  try {
    return {
      forecast: await fetchLiveForecast(),
      updatedAt: new Date().toISOString(),
      error: null,
      stale: false,
    }
  } catch (error) {
    if (previous?.forecast) {
      return {
        forecast: previous.forecast,
        updatedAt: previous.updatedAt,
        error: error instanceof Error ? error.message : 'Weather fetch failed',
        stale: true,
      }
    }

    return {
      forecast: null,
      updatedAt: null,
      error: error instanceof Error ? error.message : 'Weather fetch failed',
      stale: false,
    }
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

function weatherCodeIcon(code: number): IconType {
  if (code === 0) return WiDaySunny
  if (code === 1) return WiDaySunny
  if (code === 2) return WiDayCloudy
  if (code === 3) return WiCloudy
  if (code === 45 || code === 48) return WiFog
  if (code >= 51 && code <= 55) return WiSprinkle
  if (code === 56 || code === 57) return WiSleet
  if (code >= 61 && code <= 65) return WiRain
  if (code === 66 || code === 67) return WiHail
  if (code >= 71 && code <= 77) return WiSnow
  if (code === 80) return WiDayCloudyGusts
  if (code === 81 || code === 82) return WiShowers
  if (code >= 85 && code <= 86) return WiSnow
  if (code >= 95) return WiThunderstorm

  return WiCloud
}

function temperatureStroke(state: HealthState) {
  switch (state) {
    case 'healthy':
      return 'hsl(142 76% 45%)'
    case 'warning':
      return 'hsl(38 92% 50%)'
    case 'critical':
      return 'hsl(0 84% 60%)'
  }
}

function chunkHeadlines(headlines: Headline[], pageSize: number) {
  const pages: Headline[][] = []

  for (let index = 0; index < headlines.length; index += pageSize) {
    pages.push(headlines.slice(index, index + pageSize))
  }

  return pages
}

function newsPriorityTone(priority: Headline['priority']) {
  switch (priority) {
    case 'hoog':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    case 'normaal':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
    case 'laag':
      return 'border-muted bg-muted/40 text-muted-foreground'
  }
}
