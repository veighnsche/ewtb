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
  cpuTempC: number | null
  cpuTempSeries: number[]
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
      cpuTempC: 54,
      cpuTempSeries: [50, 51, 52, 52, 53, 52, 54, 55, 54, 53, 54, 54],
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
      cpuTempC: 73,
      cpuTempSeries: [67, 68, 69, 71, 72, 74, 75, 73, 72, 74, 73, 73],
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
      cpuTempC: 41,
      cpuTempSeries: [39, 39, 40, 40, 41, 40, 41, 42, 41, 41, 40, 41],
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
      cpuTempC: 88,
      cpuTempSeries: [73, 75, 77, 79, 82, 84, 86, 87, 89, 88, 87, 88],
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
      summary: 'Patchreeks rond geheugentelling schuift op richting mergevenster na bredere review.',
      author: 'M. Corbet',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 08:24',
      age: '18m geleden',
      url: 'https://example.com/kernel-memory-accounting',
      imageSrc: '/mock-news/kernel-weekly.jpg',
    },
    {
      id: 'news-2',
      source: 'Fedora Notes',
      category: 'distro',
      title: 'Verbeteringen in packaging-workflows verminderen lokale build-churn',
      summary: 'Nieuwe cache- en pipelinekeuzes verkorten iteraties voor packagers en CI.',
      author: 'Fedora Engineering',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 08:00',
      age: '42m geleden',
      url: 'https://example.com/fedora-packaging-workflows',
      imageSrc: '/mock-news/fedora-notes.jpg',
    },
    {
      id: 'news-3',
      source: 'AI Infra Digest',
      category: 'agents',
      title: 'Nieuwe patronen ontstaan voor local-first orchestration en audit trails',
      summary: 'Lokale agent-runtimes verschuiven richting sterkere auditbaarheid en small-batch orchestration.',
      author: 'R. Patel',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 07:42',
      age: '1u geleden',
      url: 'https://example.com/local-first-orchestration',
      imageSrc: '/mock-news/ai-infra-digest.jpg',
    },
    {
      id: 'news-4',
      source: 'Linux Dispatch',
      category: 'kernel',
      title: 'Discussie laait op over scheduler-keuzes voor hybride desktop-workloads',
      summary: 'Ontwikkelaars wegen responsiviteit af tegen throughput op gemengde desktop- en buildmachines.',
      author: 'J. Hsu',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 07:28',
      age: '1u geleden',
      url: 'https://example.com/hybrid-desktop-scheduler',
      imageSrc: '/mock-news/kernel-weekly.jpg',
    },
    {
      id: 'news-5',
      source: 'Infra Brief',
      category: 'self-hosting',
      title: 'Steeds meer teams vervangen SaaS dashboards door lokale observability-stacks',
      summary: 'Meer teams kiezen voor lokale pipelines rond logs, metrics en korte retentie.',
      author: 'N. Alvarez',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 07:16',
      age: '1u geleden',
      url: 'https://example.com/local-observability-stacks',
      imageSrc: '/mock-news/ai-infra-digest.jpg',
    },
    {
      id: 'news-6',
      source: 'Open Source Weekly',
      category: 'desktop',
      title: 'Nieuwe compositor-builds richten zich nadrukkelijk op latency en leesbaarheid',
      summary: 'Releasekandidaten mikken op schonere frame pacing en duidelijkere defaults voor grote displays.',
      author: 'A. Meyer',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 06:51',
      age: '2u geleden',
      url: 'https://example.com/compositor-latency-defaults',
      imageSrc: '/mock-news/fedora-notes.jpg',
    },
    {
      id: 'news-7',
      source: 'Dev Platform Review',
      category: 'packaging',
      title: 'Pakketaanvoer vertraagt minder door strakkere cachelagen en reproduceerbare builds',
      summary: 'Reproduceerbare artefacten maken cachelagen agressiever zonder grote invalidatiegolven.',
      author: 'S. Ito',
      language: 'EN',
      priority: 'laag',
      publishedAt: '2026-03-18 06:24',
      age: '2u geleden',
      url: 'https://example.com/reproducible-build-caches',
      imageSrc: '/mock-news/fedora-notes.jpg',
    },
    {
      id: 'news-8',
      source: 'Systems Journal',
      category: 'infrastructuur',
      title: 'Lokale agent-exporters winnen terrein als alternatief voor zwaardere monitoring agents',
      summary: 'Kleine host-exporters worden aantrekkelijker voor homelabs en kleine infra-opstellingen.',
      author: 'L. Romano',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 05:58',
      age: '3u geleden',
      url: 'https://example.com/lightweight-host-exporters',
      imageSrc: '/mock-news/kernel-weekly.jpg',
    },
    {
      id: 'news-9',
      source: 'Browser Notes',
      category: 'web',
      title: 'Render-engine update verbetert tekstweergave op grote dashboards en signage-schermen',
      summary: 'Fijner font rasteren en voorspelbaardere layout zorgen voor betere leesbaarheid op afstand.',
      author: 'E. Laurent',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 05:31',
      age: '3u geleden',
      url: 'https://example.com/render-engine-signage',
      imageSrc: '/mock-news/fedora-notes.jpg',
    },
    {
      id: 'news-10',
      source: 'Release Radar',
      category: 'agents',
      title: 'Nieuwe agent-runtime legt meer nadruk op herhaalbaarheid, state snapshots en audit logs',
      summary: 'Teams vragen minder magie en meer reproduceerbare runs bij langdurige agenttaken.',
      author: 'P. Singh',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 05:04',
      age: '4u geleden',
      url: 'https://example.com/agent-runtime-audit-logs',
      imageSrc: '/mock-news/ai-infra-digest.jpg',
    },
    {
      id: 'news-11',
      source: 'Ops Journal',
      category: 'beveiliging',
      title: 'Beheerders trekken privileges strakker na nieuwe reeks supply-chain waarschuwingen',
      summary: 'Lokale buildketens en minimale rechten krijgen opnieuw prioriteit in kleine infra-teams.',
      author: 'D. Novak',
      language: 'EN',
      priority: 'hoog',
      publishedAt: '2026-03-18 04:43',
      age: '4u geleden',
      url: 'https://example.com/supply-chain-privileges',
      imageSrc: '/mock-news/kernel-weekly.jpg',
    },
    {
      id: 'news-12',
      source: 'Homelab Weekly',
      category: 'self-hosting',
      title: 'Meer homelabs verschuiven van losse dashboards naar één samengestelde wall-weergave',
      summary: 'Samengevoegde statuswanden vervangen steeds vaker meerdere kleine losse monitorpagina’s.',
      author: 'C. Warren',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 04:11',
      age: '4u geleden',
      url: 'https://example.com/homelab-wall-overview',
      imageSrc: '/mock-news/ai-infra-digest.jpg',
    },
    {
      id: 'news-13',
      source: 'Platform Wire',
      category: 'packaging',
      title: 'Nieuwe binary-cache strategie snijdt minuten weg uit iteratieve lokale builds',
      summary: 'Ontwikkelaars zien vooral winst in korte feedbacklussen voor dagelijkse package-aanpassingen.',
      author: 'K. Holm',
      language: 'EN',
      priority: 'laag',
      publishedAt: '2026-03-18 03:48',
      age: '5u geleden',
      url: 'https://example.com/binary-cache-feedback-loop',
      imageSrc: '/mock-news/fedora-notes.jpg',
    },
    {
      id: 'news-14',
      source: 'Systems Weekly',
      category: 'systemen',
      title: 'Thermische telemetrie krijgt meer aandacht nu compacte hosts zwaarder worden belast',
      summary: 'CPU-temperaturen en korte trendgrafieken blijken nuttiger dan kale piekwaarden op walls.',
      author: 'T. Becker',
      language: 'EN',
      priority: 'normaal',
      publishedAt: '2026-03-18 03:12',
      age: '5u geleden',
      url: 'https://example.com/thermal-telemetry-walls',
      imageSrc: '/mock-news/kernel-weekly.jpg',
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
