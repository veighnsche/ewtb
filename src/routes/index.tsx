import { AlertTriangle, CheckCircle2, Clock3, Cpu, Newspaper, Rows3, SunMedium } from 'lucide-react'
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

export const Route = createFileRoute('/')({ component: App })

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
  const healthyHosts = mockWallData.hosts.filter((host) => host.state === 'healthy').length
  const blockedTurns = mockWallData.codexTurns.filter((turn) => turn.state === 'blocked').length

  return (
    <main className="h-[100svh] w-screen overflow-hidden px-6 py-5 2xl:px-8 2xl:py-6">
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
        <header className="grid grid-cols-[1.6fr_1fr] items-end gap-6">
          <div className="space-y-3">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Event Wall
            </p>
            <div className="space-y-2">
              <h1 className="m-0 text-6xl font-semibold tracking-tight 2xl:text-7xl">
                Telemetry Overview
              </h1>
              <p className="m-0 text-xl text-muted-foreground 2xl:text-2xl">
                {mockWallData.generatedAt}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <WallChip icon={<Rows3 className="size-4" />} label={mockWallData.statusLabel} />
            <WallChip icon={<Cpu className="size-4" />} label={mockWallData.connectionLabel} />
            <WallChip
              icon={<Newspaper className="size-4" />}
              label={`${mockWallData.headlines.length} headlines staged`}
            />
            <WallChip
              icon={<SunMedium className="size-4" />}
              label={`${mockWallData.forecast.length} day forecast`}
            />
          </div>
        </header>

        <section className="grid grid-cols-3 gap-4">
          <KpiCard
            title="Healthy Hosts"
            value={`${healthyHosts}/${mockWallData.hosts.length}`}
            detail="Current machine status"
          />
          <KpiCard
            title="Blocked Turns"
            value={`${blockedTurns}`}
            detail="Completions requiring intervention"
          />
          <KpiCard
            title="Agenda Items"
            value={`${mockWallData.agenda.length}`}
            detail="Upcoming operational blocks"
          />
        </section>

        <section className="grid min-h-0 grid-cols-[1.2fr_1.05fr_0.85fr] gap-4">
          <HostsPanel hosts={mockWallData.hosts} />
          <ActivityPanel turns={mockWallData.codexTurns} />
          <SideRail
            forecast={mockWallData.forecast}
            agenda={mockWallData.agenda}
            clocks={mockWallData.clocks}
          />
        </section>
      </div>
    </main>
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

function KpiCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex min-h-32 items-center justify-between px-6 py-5 2xl:min-h-36">
        <div className="space-y-2">
          <p className="m-0 text-base uppercase tracking-[0.18em] text-muted-foreground 2xl:text-lg">
            {title}
          </p>
          <p className="m-0 text-xl text-muted-foreground 2xl:text-2xl">{detail}</p>
        </div>
        <div className="text-6xl font-semibold tracking-tight 2xl:text-7xl">{value}</div>
      </CardContent>
    </Card>
  )
}

function HostsPanel({ hosts }: { hosts: HostStatus[] }) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-3xl 2xl:text-4xl">Machine Health</CardTitle>
        <CardDescription className="text-lg 2xl:text-xl">
          Compact host summary and current metric load.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 px-6 pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-base 2xl:text-lg">Host</TableHead>
              <TableHead className="text-base 2xl:text-lg">Status</TableHead>
              <TableHead className="text-base 2xl:text-lg">Load</TableHead>
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
                    {host.state}
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

        <div className="grid min-h-0 grid-cols-3 gap-4">
          {hosts.map((host) => (
            <div key={host.id} className="rounded-lg border p-4">
              <div className="mb-4">
                <p className="m-0 text-xl font-medium 2xl:text-2xl">{host.name}</p>
                <p className="m-0 text-sm text-muted-foreground 2xl:text-base">{host.role}</p>
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

function ActivityPanel({ turns }: { turns: CodexTurn[] }) {
  return (
    <Card className="min-h-0 py-0">
      <CardHeader className="px-6 pt-5">
        <CardTitle className="text-3xl 2xl:text-4xl">Codex Activity</CardTitle>
        <CardDescription className="text-lg 2xl:text-xl">
          Recent completions and currently blocked work.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-3 px-6 pb-5">
        {turns.map((turn) => (
          <div key={turn.id} className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-sm 2xl:text-base">{turn.host}</Badge>
                <Badge variant="outline" className="text-sm 2xl:text-base">{turn.repo}</Badge>
                <Badge
                  variant="outline"
                  className={`text-sm 2xl:text-base ${toneClasses(turn.state === 'complete' ? 'healthy' : 'warning')}`}
                >
                  {turn.state === 'blocked' ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {turn.state}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="m-0 text-2xl font-medium leading-tight 2xl:text-3xl">{turn.title}</p>
                <p className="m-0 text-lg leading-7 text-muted-foreground 2xl:text-xl">
                  {turn.summary}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="m-0 text-lg font-medium 2xl:text-2xl">{turn.finishedAt}</p>
              <p className="m-0 text-base text-muted-foreground 2xl:text-lg">{turn.duration}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SideRail({
  forecast,
  agenda,
  clocks,
}: {
  forecast: Forecast[]
  agenda: AgendaItem[]
  clocks: typeof mockWallData.clocks
}) {
  return (
    <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-4">
      <Card className="py-0">
        <CardHeader className="px-6 pt-5">
          <CardTitle className="text-3xl 2xl:text-4xl">Clocks</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-5">
          {clocks.map((clock) => (
            <div key={clock.label} className="flex items-center justify-between rounded-lg border px-4 py-4">
              <div>
                <p className="m-0 text-lg font-medium 2xl:text-2xl">{clock.label}</p>
                <p className="m-0 text-sm text-muted-foreground 2xl:text-lg">{clock.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock3 className="size-5 text-muted-foreground" />
                <span className="text-4xl font-semibold tracking-tight 2xl:text-5xl">{clock.time}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="px-6 pt-5">
          <CardTitle className="text-3xl 2xl:text-4xl">Forecast</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-5">
          {forecast.map((item) => (
            <div key={item.day} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="m-0 text-xl font-medium 2xl:text-2xl">{item.day}</p>
                <p className="m-0 text-base text-muted-foreground 2xl:text-lg">{item.condition}</p>
              </div>
              <p className="m-0 text-2xl font-semibold 2xl:text-3xl">
                {item.high} / {item.low}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="min-h-0 py-0">
        <CardHeader className="px-6 pt-5">
          <CardTitle className="text-3xl 2xl:text-4xl">Agenda</CardTitle>
        </CardHeader>
        <CardContent className="grid min-h-0 gap-3 px-6 pb-5">
          {agenda.map((item, index) => (
            <div key={item.id} className="space-y-3 rounded-lg border px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="m-0 text-2xl font-medium leading-tight 2xl:text-3xl">{item.title}</p>
                <Badge variant="outline" className="text-sm 2xl:text-base">{item.time}</Badge>
              </div>
              <p className="m-0 text-lg leading-7 text-muted-foreground 2xl:text-xl">{item.context}</p>
              {index < agenda.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
