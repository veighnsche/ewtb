export type HealthState = 'healthy' | 'warning' | 'critical'

export type HostMetric = {
  label: string
  value: string
  percent: number
  state: HealthState
}

export type HostStatus = {
  id: string
  name: string
  role: string
  state: HealthState
  uptime: string
  load: string
  metrics: HostMetric[]
}

export type CodexTurn = {
  id: string
  host: string
  repo: string
  title: string
  summary: string
  finishedAt: string
  duration: string
  state: 'complete' | 'blocked'
}

export type Headline = {
  id: string
  source: string
  category: string
  title: string
  age: string
}

export type Forecast = {
  day: string
  condition: string
  high: string
  low: string
}

export type AgendaItem = {
  id: string
  time: string
  title: string
  context: string
}

export type ClockCard = {
  label: string
  time: string
  date: string
}

export type WallData = {
  generatedAt: string
  statusLabel: string
  connectionLabel: string
  clocks: ClockCard[]
  hosts: HostStatus[]
  codexTurns: CodexTurn[]
  headlines: Headline[]
  forecast: Forecast[]
  agenda: AgendaItem[]
}

export const mockWallData: WallData = {
  generatedAt: 'Updated 08:42 local',
  statusLabel: 'Wall feed nominal',
  connectionLabel: '7 local publishers online',
  clocks: [
    {
      label: 'Paris',
      time: '08:42',
      date: 'Tue 18 Mar',
    },
    {
      label: 'UTC',
      time: '07:42',
      date: 'Tue 18 Mar',
    },
    {
      label: 'Lab',
      time: '08:42',
      date: 'Low-latency link',
    },
  ],
  hosts: [
    {
      id: 'host-1',
      name: 'atlas',
      role: 'wall host',
      state: 'healthy',
      uptime: '12d 4h',
      load: '0.43 / 0.51 / 0.60',
      metrics: [
        { label: 'CPU', value: '22%', percent: 22, state: 'healthy' },
        { label: 'Memory', value: '48%', percent: 48, state: 'healthy' },
        { label: 'Disk', value: '61%', percent: 61, state: 'warning' },
      ],
    },
    {
      id: 'host-2',
      name: 'leviathan',
      role: 'builder',
      state: 'warning',
      uptime: '3d 18h',
      load: '2.11 / 1.93 / 1.72',
      metrics: [
        { label: 'CPU', value: '71%', percent: 71, state: 'warning' },
        { label: 'Memory', value: '64%', percent: 64, state: 'warning' },
        { label: 'Disk', value: '37%', percent: 37, state: 'healthy' },
      ],
    },
    {
      id: 'host-3',
      name: 'quartz',
      role: 'calendar bridge',
      state: 'healthy',
      uptime: '27d 2h',
      load: '0.08 / 0.12 / 0.18',
      metrics: [
        { label: 'CPU', value: '9%', percent: 9, state: 'healthy' },
        { label: 'Memory', value: '32%', percent: 32, state: 'healthy' },
        { label: 'Disk', value: '28%', percent: 28, state: 'healthy' },
      ],
    },
  ],
  codexTurns: [
    {
      id: 'turn-1',
      host: 'atlas',
      repo: 'ewtb',
      title: 'Front-end shell scaffolded',
      summary:
        'Generated TanStack Start, applied the shadcn preset, and replaced the stock starter copy with EWTB framing.',
      finishedAt: '08:34',
      duration: '6m',
      state: 'complete',
    },
    {
      id: 'turn-2',
      host: 'leviathan',
      repo: 'LevitateOS',
      title: 'Recipe parser test pass',
      summary:
        'Validated parser fixtures after the installation spec update and flagged one warning for follow-up.',
      finishedAt: '08:16',
      duration: '11m',
      state: 'complete',
    },
    {
      id: 'turn-3',
      host: 'quartz',
      repo: 'calendar-bridge',
      title: 'Meeting normalization blocked',
      summary:
        'OAuth refresh succeeded, but one recurring event payload still needs timezone normalization before sync.',
      finishedAt: '07:58',
      duration: '9m',
      state: 'blocked',
    },
  ],
  headlines: [
    {
      id: 'news-1',
      source: 'Kernel Weekly',
      category: 'systems',
      title: 'Kernel memory accounting patchset moves closer to merge',
      age: '18m ago',
    },
    {
      id: 'news-2',
      source: 'Fedora Notes',
      category: 'distro',
      title: 'Packaging workflow improvements reduce local build churn',
      age: '42m ago',
    },
    {
      id: 'news-3',
      source: 'AI Infra Digest',
      category: 'agents',
      title: 'New patterns emerge for local-first orchestration and audit trails',
      age: '1h ago',
    },
  ],
  forecast: [
    { day: 'Today', condition: 'Cloud break', high: '14°', low: '8°' },
    { day: 'Wed', condition: 'Clear', high: '16°', low: '7°' },
    { day: 'Thu', condition: 'Rain', high: '12°', low: '6°' },
  ],
  agenda: [
    {
      id: 'agenda-1',
      time: '09:30',
      title: 'Review wall layout pass',
      context: 'Decide screen zoning and panel priority.',
    },
    {
      id: 'agenda-2',
      time: '11:00',
      title: 'LevitateOS package audit',
      context: 'Check local recipe drift against pinned inputs.',
    },
    {
      id: 'agenda-3',
      time: '15:00',
      title: 'Calendar bridge tuning',
      context: 'Refine agent prompts for scheduling assistance.',
    },
  ],
}
