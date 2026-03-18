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
import { AlertTriangle, CheckCircle2, Clock3, Cpu, Newspaper, Rows3, SunMedium } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  mockWallData,
  type AgendaItem,
  type CodexTurn,
  type Forecast,
  type HealthState,
  type HostMetric,
  type HostStatus,
} from '#/lib/mock-wall-data'

type LiveWidgets = {
  clocks: typeof mockWallData.clocks
  forecast: Forecast[] | null
}

const CLOCKS = [
  { label: 'Parijs', timeZone: 'Europe/Paris' },
  { label: 'Palo Alto', timeZone: 'America/Los_Angeles' },
  { label: 'Shenzhen', timeZone: 'Asia/Shanghai' },
] as const

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=3'

export const Route = createFileRoute('/')({
  loader: async () => getLiveWidgets(),
  component: App,
})

const WALL_DATE = parseISO('2026-03-18T08:42:00')

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

function turnStateLabel(state: CodexTurn['state']) {
  return state === 'complete' ? 'voltooid' : 'geblokkeerd'
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
  const healthyHosts = mockWallData.hosts.filter((host) => host.state === 'healthy').length
  const blockedTurns = mockWallData.codexTurns.filter((turn) => turn.state === 'blocked').length
  const [clocks, setClocks] = useState(liveWidgets.clocks)
  const [forecast, setForecast] = useState(liveWidgets.forecast)

  useEffect(() => {
    const updateClocks = () => {
      startTransition(() => {
        setClocks(buildClockCards(new Date()))
      })
    }

    updateClocks()

    const clockTimer = window.setInterval(updateClocks, 30_000)
    const weatherTimer = window.setInterval(async () => {
      const nextForecast = await fetchForecastOrNull()

      startTransition(() => {
        setForecast(nextForecast)
      })
    }, 30 * 60_000)

    return () => {
      window.clearInterval(clockTimer)
      window.clearInterval(weatherTimer)
    }
  }, [])

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
                {mockWallData.generatedAt}
              </p>
            </div>
          </div>
          <CalendarPanel />
          <div className="grid grid-cols-2 gap-3">
            <WallChip icon={<Rows3 className="size-4" />} label={mockWallData.statusLabel} />
            <WallChip icon={<Cpu className="size-4" />} label={mockWallData.connectionLabel} />
            <WallChip
              icon={<Newspaper className="size-4" />}
              label={`${mockWallData.headlines.length} koppen klaar`}
            />
            <WallChip
              icon={<SunMedium className="size-4" />}
              label={forecast ? `${forecast.length} dagen vooruitzicht` : 'weer offline'}
            />
          </div>
        </header>

        <section className="grid min-h-0 grid-cols-[0.95fr_1.2fr_1fr] gap-4">
          <HostsPanel
            hosts={mockWallData.hosts}
            healthyHosts={healthyHosts}
            blockedTurns={blockedTurns}
          />
          <AgendaPanel agenda={mockWallData.agenda} />
          <RightRail
            turns={mockWallData.codexTurns}
            forecast={forecast}
            clocks={clocks}
          />
        </section>
      </div>
    </main>
  )
}

function CalendarPanel() {
  const days = buildWallCalendar()

  return (
    <div className="grid grid-cols-14 gap-x-2 gap-y-3 self-center px-2">
      {days.map((day, index) => (
        <div
          key={day.iso}
          className={[
            'text-center',
            day.isToday ? 'text-primary' : '',
            day.isWeekend ? 'text-muted-foreground/70' : '',
            day.isPastMonth && index < 14 ? 'opacity-50' : '',
            day.isNextMonth && index >= 42 ? 'opacity-50' : '',
          ].join(' ')}
        >
          <p className="m-0 text-2xl font-semibold leading-none 2xl:text-3xl">
            {day.day}
          </p>
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
  healthyHosts,
  blockedTurns,
}: {
  hosts: HostStatus[]
  healthyHosts: number
  blockedTurns: number
}) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-3xl 2xl:text-4xl">Systeemstatus</CardTitle>
        <CardDescription className="text-lg 2xl:text-xl">
          Overzicht van de systemen. De agenda blijft de hoofdzaak.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 px-6 pb-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border px-4 py-4">
            <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted-foreground 2xl:text-base">
              Systemen OK
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight 2xl:text-6xl">
              {healthyHosts}/{hosts.length}
            </p>
          </div>
          <div className="rounded-lg border px-4 py-4">
            <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted-foreground 2xl:text-base">
              Geblokkeerde taken
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight 2xl:text-6xl">
              {blockedTurns}
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-base 2xl:text-lg">Host</TableHead>
              <TableHead className="text-base 2xl:text-lg">Status</TableHead>
              <TableHead className="text-base 2xl:text-lg">Belasting</TableHead>
              <TableHead className="text-base 2xl:text-lg">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hosts.map((host) => (
              <TableRow key={host.id}>
                <TableCell className="py-3">
                  <div className="space-y-1">
                    <div className="text-lg font-medium 2xl:text-xl">{host.name}</div>
                    <div className="text-sm text-muted-foreground 2xl:text-base">{host.role}</div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant="outline" className={`text-sm 2xl:text-base ${toneClasses(host.state)}`}>
                    {healthStateLabel(host.state)}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 font-mono text-base 2xl:text-lg">{host.load}</TableCell>
                <TableCell className="py-3 text-base text-muted-foreground 2xl:text-lg">
                  {host.uptime}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid min-h-0 grid-cols-2 gap-4">
          {hosts.map((host) => (
            <div key={host.id} className="rounded-lg border p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-xl font-medium 2xl:text-2xl">{host.name}</p>
                  <p className="m-0 text-sm text-muted-foreground 2xl:text-base">{host.role}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-sm 2xl:text-base ${toneClasses(host.state)}`}
                >
                  {healthStateLabel(host.state)}
                </Badge>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm 2xl:text-base">
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <p className="m-0 text-xs uppercase tracking-[0.16em] text-muted-foreground 2xl:text-sm">
                    Uptime
                  </p>
                  <p className="mt-1 mb-0 font-medium">{host.uptime}</p>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <p className="m-0 text-xs uppercase tracking-[0.16em] text-muted-foreground 2xl:text-sm">
                    Belasting
                  </p>
                  <p className="mt-1 mb-0 font-mono text-sm 2xl:text-base">{host.load}</p>
                </div>
              </div>
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

function AgendaPanel({ agenda }: { agenda: AgendaItem[] }) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-4xl 2xl:text-5xl">Agenda vandaag</CardTitle>
        <CardDescription className="text-lg 2xl:text-xl">
          Belangrijkste onderdeel van de wall. Dit moet in een oogopslag leesbaar zijn vanaf de andere kant van de kamer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-4 px-6 pb-5">
        {agenda.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr] gap-5 rounded-lg border p-5">
            <div className="flex min-w-32 flex-col items-start justify-between rounded-md bg-muted/40 px-4 py-3">
              <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted-foreground 2xl:text-base">
                Tijd
              </p>
              <p className="m-0 text-4xl font-semibold tracking-tight 2xl:text-5xl">{item.time}</p>
            </div>
            <div className="space-y-3">
              <p className="m-0 text-3xl font-medium leading-tight 2xl:text-4xl">{item.title}</p>
              <p className="m-0 text-xl leading-8 text-muted-foreground 2xl:text-2xl">
                {item.context}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActivityPanel({ turns }: { turns: CodexTurn[] }) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-5 pt-4">
        <CardTitle className="text-2xl 2xl:text-3xl">Codex-werk</CardTitle>
        <CardDescription className="text-base 2xl:text-lg">
          Secundaire feed. Wel zichtbaar, niet dominant.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-3 px-5 pb-5">
        {turns.map((turn) => (
          <div key={turn.id} className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs 2xl:text-sm">{turn.host}</Badge>
                <Badge variant="outline" className="text-xs 2xl:text-sm">{turn.repo}</Badge>
                <Badge
                  variant="outline"
                  className={`text-xs 2xl:text-sm ${toneClasses(turn.state === 'complete' ? 'healthy' : 'warning')}`}
                >
                  {turn.state === 'blocked' ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  {turnStateLabel(turn.state)}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="m-0 text-xl font-medium leading-tight 2xl:text-2xl">{turn.title}</p>
                <p className="m-0 text-base leading-6 text-muted-foreground 2xl:text-lg">
                  {turn.summary}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="m-0 text-base font-medium 2xl:text-xl">{turn.finishedAt}</p>
              <p className="m-0 text-sm text-muted-foreground 2xl:text-base">{turn.duration}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RightRail({
  turns,
  forecast,
  clocks,
}: {
  turns: CodexTurn[]
  forecast: Forecast[] | null
  clocks: typeof mockWallData.clocks
}) {
  return (
    <div className="grid min-h-0 grid-rows-[1.1fr_auto] gap-4">
      <ActivityPanel turns={turns} />

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
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5">
            {forecast ? (
              forecast.map((item) => (
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
                  Geen verbinding met de weerbron. Er wordt geen mock data getoond.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildWallCalendar() {
  const firstOfMonth = startOfMonth(WALL_DATE)
  const start = startOfWeek(firstOfMonth, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end: addDays(start, 55) })

  return days.map((current) => {
    return {
      iso: formatISO(current, { representation: 'date' }),
      day: format(current, 'd'),
      isWeekend: isWeekend(current),
      isToday: isSameDay(current, WALL_DATE),
      isPastMonth: !isSameMonth(current, WALL_DATE) && isBefore(current, WALL_DATE),
      isNextMonth: !isSameMonth(current, WALL_DATE) && !isBefore(current, WALL_DATE),
    }
  })
}

async function getLiveWidgets(): Promise<LiveWidgets> {
  const now = new Date()

  return {
    clocks: buildClockCards(now),
    forecast: await fetchForecastOrNull(),
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
  const response = await fetch(WEATHER_URL)

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
}

async function fetchForecastOrNull() {
  try {
    return await fetchLiveForecast()
  } catch {
    return null
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
