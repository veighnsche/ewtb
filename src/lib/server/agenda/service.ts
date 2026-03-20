import '@tanstack/react-start/server-only'

import {
  addDays,
  endOfDay,
  format,
  formatISO,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  isTomorrow,
  parse,
  startOfDay,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { XMLParser } from 'fast-xml-parser'
import type { AgendaItem, AgendaTask } from '#/lib/wall-types'

const DEFAULT_AGENDA_LIMIT = 8
const DEFAULT_TASK_LIMIT = 8
const DEFAULT_CALDAV_BASE_URL = 'https://caldav.example.com'
const DEFAULT_CALDAV_USERNAME = 'you@example.com'
const DEFAULT_CALDAV_PASSWORD = '<FILL IN PASSWORD>'
const DEFAULT_CALDAV_TIMEZONE = 'Europe/Paris'
const CALDAV_LOOKAHEAD_DAYS = 120
const AGENDA_REFRESH_MS = 60_000
const INITIAL_AGENDA_WAIT_MS = 250
const globalKey = '__ewtbAgendaCollectorState'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
})

type CalendarEvent = {
  id: string
  calendar: string
  startAt: Date
  endAt: Date | null
  isAllDay: boolean
  title: string
  description: string
}

type CalendarTodo = {
  id: string
  calendar: string
  dueAt: Date | null
  isAllDay: boolean
  title: string
  description: string
  status: string | null
  percentComplete: number | null
}

type CalendarCollection = {
  name: string
  displayName: string
  href: string
}

type CaldavConfig = {
  baseUrl: string
  username: string
  password: string
  timezone: string
}

type IcsProperty = {
  value: string
  params: Record<string, string>
}

type WallAgendaFeed = {
  status: 'live' | 'loading' | 'error'
  error: string | null
  updatedAt: string | null
  stale: boolean
  items: AgendaItem[]
  tasks: AgendaTask[]
}

type AgendaCollectorState = {
  cache: WallAgendaFeed | null
  refreshPromise: Promise<WallAgendaFeed> | null
  started: boolean
}

export async function getWallAgendaData(): Promise<WallAgendaFeed> {
  const state = getCollectorState()
  startCollectorLoop(state)

  if (state.cache) {
    return state.cache
  }

  if (state.refreshPromise) {
    return waitForInitialRefresh(state.refreshPromise)
  }

  return buildLoadingFeed()
}

function getCollectorState(): AgendaCollectorState {
  const globalState = globalThis as typeof globalThis & {
    [globalKey]?: AgendaCollectorState
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

function startCollectorLoop(state: AgendaCollectorState) {
  if (state.started) {
    return
  }

  state.started = true

  void refreshAgendaFeed(state)

  const timer = setInterval(() => {
    void refreshAgendaFeed(state)
  }, AGENDA_REFRESH_MS)
  timer.unref?.()
}

function buildLoadingFeed(): WallAgendaFeed {
  return {
    status: 'loading',
    error: null,
    updatedAt: null,
    stale: false,
    items: [],
    tasks: [],
  }
}

function buildErrorFeed(error: string, previous?: WallAgendaFeed | null): WallAgendaFeed {
  if ((previous?.items.length ?? 0) > 0 || (previous?.tasks.length ?? 0) > 0) {
    return {
      status: 'live',
      error,
      updatedAt: previous?.updatedAt ?? new Date().toISOString(),
      stale: true,
      items: previous?.items ?? [],
      tasks: previous?.tasks ?? [],
    }
  }

  return {
    status: 'error',
    error,
    updatedAt: previous?.updatedAt ?? new Date().toISOString(),
    stale: false,
    items: [],
    tasks: [],
  }
}

async function waitForInitialRefresh(refreshPromise: Promise<WallAgendaFeed>) {
  return new Promise<WallAgendaFeed>((resolve) => {
    const timer = setTimeout(() => {
      resolve(buildLoadingFeed())
    }, INITIAL_AGENDA_WAIT_MS)

    void refreshPromise.then((feed) => {
      clearTimeout(timer)
      resolve(feed)
    })
  })
}

async function refreshAgendaFeed(state: AgendaCollectorState): Promise<WallAgendaFeed> {
  if (state.refreshPromise) {
    return state.refreshPromise
  }

  state.refreshPromise = collectAgendaFeed()
    .then((result) => {
      state.cache = result
      return result
    })
    .catch((error) => {
      const fallback = buildErrorFeed(
        error instanceof Error ? error.message : 'Agenda ophalen mislukt',
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

async function collectAgendaFeed(): Promise<WallAgendaFeed> {
  const { events, tasks } = await readWallCalendarData()
  const now = new Date()

  if (events.length === 0 && tasks.length === 0) {
    return {
      status: 'error',
      error: 'Geen komende agenda-items of taken beschikbaar',
      updatedAt: new Date().toISOString(),
      stale: false,
      items: [],
      tasks: [],
    }
  }

  return {
    status: 'live',
    error: null,
    updatedAt: new Date().toISOString(),
    stale: false,
    items: events.slice(0, DEFAULT_AGENDA_LIMIT).map((event) => ({
      id: event.id,
      calendar: event.calendar,
      dateIso: formatISO(event.startAt, { representation: 'date' }),
      dateLabel: formatAgendaDateLabel(event.startAt),
      time: event.isAllDay ? 'Hele dag' : format(event.startAt, 'HH:mm'),
      endTime: event.isAllDay || !event.endAt ? null : format(event.endAt, 'HH:mm'),
      timeLabel: formatAgendaTimeLabel(event),
      title: event.title,
      context: event.description || 'Geen extra toelichting.',
      isPast: isBefore(event.startAt, now),
      isAllDay: event.isAllDay,
    })),
    tasks: tasks.slice(0, DEFAULT_TASK_LIMIT).map((task) => ({
      id: task.id,
      calendar: task.calendar,
      title: task.title,
      context: task.description || 'Geen extra toelichting.',
      dueIso: task.dueAt ? formatISO(task.dueAt, { representation: 'date' }) : null,
      dueLabel: formatTaskDueLabel(task),
      statusLabel: formatTaskStatusLabel(task, now),
      isOverdue: isTaskOverdue(task, now),
    })),
  }
}

async function readWallCalendarData() {
  const config = readCaldavConfig()
  const collections = await discoverCalendars(config)
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const queryEnd = addDays(todayEnd, CALDAV_LOOKAHEAD_DAYS)

  const [nestedEvents, nestedTodos] = await Promise.all([
    Promise.all(
      collections.map((collection) =>
        fetchCalendarEvents(config, collection, todayStart, queryEnd),
      ),
    ),
    Promise.allSettled(collections.map((collection) => fetchCalendarTodos(config, collection))),
  ])

  const events = nestedEvents
    .flat()
    .filter((event) => shouldIncludeEvent(event, now, todayStart, todayEnd))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())

  const tasks = flattenSettledArrays(nestedTodos)
    .filter((task) => shouldIncludeTask(task))
    .sort(compareCalendarTodos)

  return { events, tasks }
}

function readCaldavConfig(): CaldavConfig {
  const baseUrl = process.env.CALDAV_BASE_URL?.trim() || DEFAULT_CALDAV_BASE_URL
  const username = process.env.CALDAV_USERNAME?.trim() || DEFAULT_CALDAV_USERNAME
  const password = process.env.CALDAV_PASSWORD?.trim() || DEFAULT_CALDAV_PASSWORD
  const timezone = process.env.CALDAV_TIMEZONE?.trim() || DEFAULT_CALDAV_TIMEZONE

  if (!baseUrl) {
    throw new Error('CalDAV-server ontbreekt')
  }

  if (!username) {
    throw new Error('CalDAV-gebruiker ontbreekt')
  }

  if (!password || password === DEFAULT_CALDAV_PASSWORD) {
    throw new Error('CalDAV-wachtwoord ontbreekt')
  }

  return { baseUrl, username, password, timezone }
}

async function discoverCalendars(config: CaldavConfig) {
  const principalXml = await caldavRequest(
    config,
    config.baseUrl,
    'PROPFIND',
    `<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
    '0',
  )
  const principalHref = extractNestedHref(firstOkProp(principalXml)?.['current-user-principal'])

  if (!principalHref) {
    throw new Error('CalDAV principal niet gevonden')
  }

  const principalUrl = absoluteUrl(config.baseUrl, principalHref)
  const homeXml = await caldavRequest(
    config,
    principalUrl,
    'PROPFIND',
    `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
    '0',
  )
  const homeHref = extractNestedHref(firstOkProp(homeXml)?.['calendar-home-set'])

  if (!homeHref) {
    throw new Error('CalDAV calendar-home-set niet gevonden')
  }

  const homeUrl = absoluteUrl(config.baseUrl, homeHref)
  const calendarsXml = await caldavRequest(
    config,
    homeUrl,
    'PROPFIND',
    `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>`,
    '1',
  )

  const responses = toArray(parsedResponses(calendarsXml))
  const homeNormalized = normalizeHref(homeHref)
  const calendars = responses
    .map((response) => {
      const href = typeof response?.href === 'string' ? response.href.trim() : ''
      const prop = okProp(response)

      if (!href || !prop || !isCalendarResource(prop.resourcetype)) {
        return null
      }

      if (normalizeHref(href) === homeNormalized) {
        return null
      }

      const name = decodeURIComponent(lastPathSegment(href))
      if (!name) {
        return null
      }

      return {
        name,
        displayName: (typeof prop.displayname === 'string' && prop.displayname.trim()) || name,
        href: absoluteUrl(homeUrl, href),
      } satisfies CalendarCollection
    })
    .filter((collection): collection is CalendarCollection => collection !== null)

  if (calendars.length === 0) {
    throw new Error('Geen CalDAV-agenda’s gevonden')
  }

  return calendars
}

async function fetchCalendarEvents(
  config: CaldavConfig,
  collection: CalendarCollection,
  windowStart: Date,
  windowEnd: Date,
) {
  const start = formatInTimeZone(windowStart, 'UTC', "yyyyMMdd'T'HHmmss'Z'")
  const end = formatInTimeZone(windowEnd, 'UTC', "yyyyMMdd'T'HHmmss'Z'")
  const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
    <d:prop>
      <d:getetag/>
      <c:calendar-data>
        <c:expand start="${start}" end="${end}"/>
      </c:calendar-data>
    </d:prop>
    <c:filter>
      <c:comp-filter name="VCALENDAR">
        <c:comp-filter name="VEVENT">
          <c:time-range start="${start}" end="${end}"/>
        </c:comp-filter>
      </c:comp-filter>
    </c:filter>
  </c:calendar-query>`
  const xml = await caldavRequest(config, collection.href, 'REPORT', body, '1')
  const responses = toArray(parsedResponses(xml))

  return responses.flatMap((response) => {
    const href = typeof response?.href === 'string' ? response.href.trim() : collection.href
    const prop = okProp(response)
    const calendarData = typeof prop?.['calendar-data'] === 'string' ? prop['calendar-data'] : null

    if (!calendarData) {
      return []
    }

    return parseCalendarEvents(collection.displayName, href, calendarData, config.timezone)
  })
}

async function fetchCalendarTodos(config: CaldavConfig, collection: CalendarCollection) {
  const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
    <d:prop>
      <d:getetag/>
      <c:calendar-data/>
    </d:prop>
    <c:filter>
      <c:comp-filter name="VCALENDAR">
        <c:comp-filter name="VTODO"/>
      </c:comp-filter>
    </c:filter>
  </c:calendar-query>`
  const xml = await caldavRequest(config, collection.href, 'REPORT', body, '1')
  const responses = toArray(parsedResponses(xml))

  return responses.flatMap((response) => {
    const href = typeof response?.href === 'string' ? response.href.trim() : collection.href
    const prop = okProp(response)
    const calendarData = typeof prop?.['calendar-data'] === 'string' ? prop['calendar-data'] : null

    if (!calendarData) {
      return []
    }

    return parseCalendarTodos(collection.displayName, href, calendarData, config.timezone)
  })
}

async function caldavRequest(
  config: CaldavConfig,
  url: string,
  method: 'PROPFIND' | 'REPORT',
  body: string,
  depth: '0' | '1',
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
      Depth: depth,
      'Content-Type': 'application/xml; charset=utf-8',
      Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
    },
    body,
  })

  if (!response.ok && response.status !== 207) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('CalDAV-aanmelding mislukt')
    }

    throw new Error(`CalDAV-verzoek mislukt (${response.status})`)
  }

  return response.text()
}

function parseCalendarEvents(
  calendar: string,
  href: string,
  raw: string,
  fallbackTimezone: string,
) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []

  return blocks
    .map((block, index) => parseCalendarEvent(calendar, href, block, index, fallbackTimezone))
    .filter((event): event is CalendarEvent => event !== null)
}

function parseCalendarTodos(
  calendar: string,
  href: string,
  raw: string,
  fallbackTimezone: string,
) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.match(/BEGIN:VTODO[\s\S]*?END:VTODO/g) ?? []

  return blocks
    .map((block, index) => parseCalendarTodo(calendar, href, block, index, fallbackTimezone))
    .filter((task): task is CalendarTodo => task !== null)
}

function parseCalendarEvent(
  calendar: string,
  href: string,
  raw: string,
  index: number,
  fallbackTimezone: string,
): CalendarEvent | null {
  const title = readIcsProperty(raw, 'SUMMARY')?.value
  const description = readIcsProperty(raw, 'DESCRIPTION')?.value?.replace(/\\n/g, ' ') ?? ''
  const dtStart = readIcsProperty(raw, 'DTSTART')
  const dtEnd = readIcsProperty(raw, 'DTEND')

  if (!title || !dtStart) {
    return null
  }

  const start = parseIcsDate(dtStart, fallbackTimezone)
  if (!start) {
    return null
  }

  const end = dtEnd ? parseIcsDate(dtEnd, fallbackTimezone) : null
  const id = `${decodeURIComponent(lastPathSegment(href.replace(/\/$/, '')))}-${index}`.replace(/\.ics-/u, '-')

  return {
    id: id.replace(/\.ics$/u, ''),
    calendar,
    startAt: start.date,
    endAt: end?.date ?? null,
    isAllDay: start.isAllDay,
    title,
    description,
  }
}

function parseCalendarTodo(
  calendar: string,
  href: string,
  raw: string,
  index: number,
  fallbackTimezone: string,
): CalendarTodo | null {
  const summary = readIcsProperty(raw, 'SUMMARY')?.value?.trim()
  const description = readIcsProperty(raw, 'DESCRIPTION')?.value?.replace(/\\n/g, ' ') ?? ''
  const due = readIcsProperty(raw, 'DUE')
  const dtStart = readIcsProperty(raw, 'DTSTART')
  const status = readIcsProperty(raw, 'STATUS')?.value?.trim().toUpperCase() ?? null
  const percentCompleteValue = readIcsProperty(raw, 'PERCENT-COMPLETE')?.value?.trim()
  const dueValue = due ? parseIcsDate(due, fallbackTimezone) : dtStart ? parseIcsDate(dtStart, fallbackTimezone) : null
  const id = `${decodeURIComponent(lastPathSegment(href.replace(/\/$/, '')))}-${index}`.replace(/\.ics-/u, '-')
  const percentComplete =
    percentCompleteValue && /^\d+$/u.test(percentCompleteValue)
      ? Number.parseInt(percentCompleteValue, 10)
      : null

  return {
    id: id.replace(/\.ics$/u, ''),
    calendar,
    dueAt: dueValue?.date ?? null,
    isAllDay: dueValue?.isAllDay ?? false,
    title: summary || 'Naamloze taak',
    description,
    status,
    percentComplete,
  }
}

function parseIcsDate(property: IcsProperty, fallbackTimezone: string) {
  const value = property.value.trim()
  const timezone = property.params.TZID || fallbackTimezone
  const valueKind = (property.params.VALUE || '').toUpperCase()
  const isAllDay = valueKind === 'DATE' || !value.includes('T')

  if (isAllDay) {
    const date = parse(value, 'yyyyMMdd', new Date())
    return Number.isNaN(date.getTime()) ? null : { date, isAllDay: true }
  }

  const zoned = parseDateTimeValue(value)
  if (!zoned) {
    return null
  }

  if (zoned.utc) {
    return { date: zoned.date, isAllDay: false }
  }

  return {
    date: fromZonedTime(zoned.date, timezone),
    isAllDay: false,
  }
}

function parseDateTimeValue(value: string) {
  const patterns = value.endsWith('Z')
    ? ["yyyyMMdd'T'HHmmssX", "yyyyMMdd'T'HHmmX", "yyyyMMdd'T'HHmmss'Z'", "yyyyMMdd'T'HHmm'Z'"]
    : ["yyyyMMdd'T'HHmmss", "yyyyMMdd'T'HHmm"]

  for (const pattern of patterns) {
    const date = parse(value, pattern, new Date())

    if (!Number.isNaN(date.getTime())) {
      return { date, utc: value.endsWith('Z') || /[+-]\d{4}$/u.test(value) }
    }
  }

  return null
}

function readIcsProperty(input: string, key: string): IcsProperty | null {
  const match = input.match(new RegExp(`^${key}((?:;[^:\\r\\n]+)*)?:(.+)$`, 'm'))

  if (!match) {
    return null
  }

  return {
    value: match[2]?.trim() ?? '',
    params: parseIcsParams(match[1] ?? ''),
  }
}

function parseIcsParams(raw: string) {
  return raw
    .split(';')
    .filter(Boolean)
    .reduce<Record<string, string>>((params, part) => {
      const [key, ...rest] = part.split('=')

      if (!key || rest.length === 0) {
        return params
      }

      params[key.toUpperCase()] = rest.join('=').trim()
      return params
    }, {})
}

function shouldIncludeEvent(event: CalendarEvent, now: Date, todayStart: Date, todayEnd: Date) {
  if (isToday(event.startAt)) {
    return !isBefore(event.startAt, todayStart) && !isAfter(event.startAt, todayEnd)
  }

  if (isAfter(event.startAt, now)) {
    return true
  }

  if (event.endAt && isAfter(event.endAt, todayStart)) {
    return true
  }

  return false
}

function shouldIncludeTask(task: CalendarTodo) {
  if (task.percentComplete !== null && task.percentComplete >= 100) {
    return false
  }

  return task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
}

function compareCalendarTodos(left: CalendarTodo, right: CalendarTodo) {
  const leftDue = left.dueAt?.getTime() ?? Number.POSITIVE_INFINITY
  const rightDue = right.dueAt?.getTime() ?? Number.POSITIVE_INFINITY

  if (leftDue !== rightDue) {
    return leftDue - rightDue
  }

  return left.title.localeCompare(right.title, 'nl')
}

function formatAgendaDateLabel(value: Date) {
  const fullDate = format(value, 'EEEE d MMMM', { locale: nl })

  if (isToday(value)) {
    return `Vandaag • ${fullDate}`
  }

  if (isTomorrow(value)) {
    return `Morgen • ${fullDate}`
  }

  return fullDate
}

function formatAgendaTimeLabel(event: CalendarEvent) {
  if (event.isAllDay) {
    return 'Hele dag'
  }

  if (!event.endAt) {
    return format(event.startAt, 'HH:mm')
  }

  if (!isSameDay(event.startAt, event.endAt)) {
    return `${format(event.startAt, 'HH:mm')} - meerdaags`
  }

  return `${format(event.startAt, 'HH:mm')} - ${format(event.endAt, 'HH:mm')}`
}

function formatTaskDueLabel(task: CalendarTodo) {
  if (!task.dueAt) {
    return 'Geen deadline'
  }

  const fullDate = format(task.dueAt, 'EEEE d MMMM', { locale: nl })

  if (isToday(task.dueAt)) {
    return task.isAllDay ? 'Vandaag' : `Vandaag • ${format(task.dueAt, 'HH:mm')}`
  }

  if (isTomorrow(task.dueAt)) {
    return task.isAllDay ? 'Morgen' : `Morgen • ${format(task.dueAt, 'HH:mm')}`
  }

  return task.isAllDay ? fullDate : `${fullDate} • ${format(task.dueAt, 'HH:mm')}`
}

function formatTaskStatusLabel(task: CalendarTodo, now: Date) {
  if (isTaskOverdue(task, now)) {
    return 'Achter'
  }

  if (task.status === 'IN-PROCESS') {
    return 'Bezig'
  }

  return 'Open'
}

function isTaskOverdue(task: CalendarTodo, now: Date) {
  if (!task.dueAt) {
    return false
  }

  if (task.isAllDay) {
    return isBefore(task.dueAt, startOfDay(now))
  }

  return isBefore(task.dueAt, now)
}

function parsedResponses(xml: string) {
  const parsed = xmlParser.parse(xml)
  return parsed?.multistatus?.response ?? []
}

function firstOkProp(xml: string) {
  const [response] = toArray(parsedResponses(xml))
  return okProp(response)
}

function okProp(response: any) {
  const propstats = toArray(response?.propstat)
  const match = propstats.find((propstat) => String(propstat?.status ?? '').includes(' 200 '))

  return match?.prop ?? null
}

function extractNestedHref(value: any): string | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (typeof value?.href === 'string') {
    return value.href.trim() || null
  }

  return null
}

function isCalendarResource(resourceType: any) {
  return resourceType && typeof resourceType === 'object' && 'calendar' in resourceType
}

function absoluteUrl(base: string, href: string) {
  return new URL(href, base).toString()
}

function normalizeHref(href: string) {
  return href.replace(/\/+$/u, '')
}

function lastPathSegment(href: string) {
  return href.split('/').filter(Boolean).at(-1) ?? ''
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return value == null ? [] : [value]
}

function flattenSettledArrays<T>(settledResults: PromiseSettledResult<T[]>[]) {
  return settledResults.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  )
}

export type { WallAgendaFeed }
