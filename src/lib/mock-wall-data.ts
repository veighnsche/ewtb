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
  code?: number
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
  generatedAt: 'Bijgewerkt 08:42 lokaal',
  statusLabel: 'Wall-feed normaal',
  connectionLabel: '7 lokale bronnen online',
  clocks: [
    {
      label: 'Parijs',
      time: '08:42',
      date: 'di 18 mrt',
    },
    {
      label: 'Palo Alto',
      time: '00:42',
      date: 'di 18 mrt',
    },
    {
      label: 'Shenzhen',
      time: '15:42',
      date: 'di 18 mrt',
    },
  ],
  hosts: [
    {
      id: 'host-1',
      name: 'atlas',
      role: 'wall host',
      state: 'healthy',
      uptime: '12d 4u',
      load: '0.43 / 0.51 / 0.60',
      metrics: [
        { label: 'CPU', value: '22%', percent: 22, state: 'healthy' },
        { label: 'Geheugen', value: '48%', percent: 48, state: 'healthy' },
        { label: 'Schijf', value: '61%', percent: 61, state: 'warning' },
      ],
    },
    {
      id: 'host-2',
      name: 'leviathan',
      role: 'builder',
      state: 'warning',
      uptime: '3d 18u',
      load: '2.11 / 1.93 / 1.72',
      metrics: [
        { label: 'CPU', value: '71%', percent: 71, state: 'warning' },
        { label: 'Geheugen', value: '64%', percent: 64, state: 'warning' },
        { label: 'Schijf', value: '37%', percent: 37, state: 'healthy' },
      ],
    },
    {
      id: 'host-3',
      name: 'quartz',
      role: 'agenda-koppeling',
      state: 'healthy',
      uptime: '27d 2u',
      load: '0.08 / 0.12 / 0.18',
      metrics: [
        { label: 'CPU', value: '9%', percent: 9, state: 'healthy' },
        { label: 'Geheugen', value: '32%', percent: 32, state: 'healthy' },
        { label: 'Schijf', value: '28%', percent: 28, state: 'healthy' },
      ],
    },
    {
      id: 'host-4',
      name: 'relay',
      role: 'nieuwsfeed',
      state: 'critical',
      uptime: '6u 12m',
      load: '3.48 / 2.91 / 2.44',
      metrics: [
        { label: 'CPU', value: '92%', percent: 92, state: 'critical' },
        { label: 'Geheugen', value: '81%', percent: 81, state: 'warning' },
        { label: 'Schijf', value: '73%', percent: 73, state: 'warning' },
      ],
    },
  ],
  codexTurns: [
    {
      id: 'turn-1',
      host: 'atlas',
      repo: 'ewtb',
      title: 'Front-end opgezet',
      summary:
        'TanStack Start gegenereerd, de shadcn-preset toegepast en de standaardteksten vervangen door EWTB-copy.',
      finishedAt: '08:34',
      duration: '6m',
      state: 'complete',
    },
    {
      id: 'turn-2',
      host: 'leviathan',
      repo: 'LevitateOS',
      title: 'Recipe-parser getest',
      summary:
        'Parserfixtures gevalideerd na de update van de installatiespecificatie en een waarschuwing gemarkeerd voor opvolging.',
      finishedAt: '08:16',
      duration: '11m',
      state: 'complete',
    },
    {
      id: 'turn-3',
      host: 'quartz',
      repo: 'calendar-bridge',
      title: 'Meeting-normalisatie loopt vast',
      summary:
        'OAuth-refresh is gelukt, maar een terugkerend event moet nog op timezone worden rechtgetrokken voor de sync.',
      finishedAt: '07:58',
      duration: '9m',
      state: 'blocked',
    },
  ],
  headlines: [
    {
      id: 'news-1',
      source: 'Kernel Weekly',
      category: 'systemen',
      title: 'Kernel-patchset voor geheugentelling komt dichter bij merge',
      age: '18m geleden',
    },
    {
      id: 'news-2',
      source: 'Fedora Notes',
      category: 'distro',
      title: 'Verbeteringen in packaging-workflows verminderen lokale build-churn',
      age: '42m geleden',
    },
    {
      id: 'news-3',
      source: 'AI Infra Digest',
      category: 'agents',
      title: 'Nieuwe patronen ontstaan voor local-first orchestration en audit trails',
      age: '1u geleden',
    },
  ],
  forecast: [
    { day: 'Vandaag', condition: 'Wolken en opklaringen', high: '14°', low: '8°', code: 2 },
    { day: 'Wo', condition: 'Helder', high: '16°', low: '7°', code: 0 },
    { day: 'Do', condition: 'Regen', high: '12°', low: '6°', code: 61 },
  ],
  agenda: [
    {
      id: 'agenda-1',
      time: '09:30',
      title: 'Wall-layout review',
      context: 'Schermzones en paneelprioriteit bepalen.',
    },
    {
      id: 'agenda-2',
      time: '11:00',
      title: 'LevitateOS package-audit',
      context: 'Lokale recipe-drift controleren tegen gepinde inputs.',
    },
    {
      id: 'agenda-3',
      time: '15:00',
      title: 'Agenda-koppeling bijstellen',
      context: 'Agentprompts aanscherpen voor planningshulp.',
    },
  ],
}
