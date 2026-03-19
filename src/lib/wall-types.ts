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
  error: string | null
  uptime: string
  load: string
  cpuTempC: number | null
  cpuTempSeries: number[]
  metrics: HostMetric[]
}

export type Headline = {
  id: string
  source: string
  category: string
  title: string
  summary: string
  author: string
  language: string
  priority: 'hoog' | 'normaal' | 'laag'
  publishedAt: string
  age: string
  url: string
  imageSrc: string | null
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
  dateIso: string
  dateLabel: string
  time: string
  title: string
  context: string
}

export type ClockCard = {
  label: string
  time: string
  date: string
}
