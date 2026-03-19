import '@tanstack/react-start/server-only'

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  format,
  formatISO,
  isAfter,
  isToday,
  isTomorrow,
  parse,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import type { AgendaItem } from '#/lib/wall-types'

const DEFAULT_AGENDA_LIMIT = 8
const RADICALE_WALL_PATH =
  process.env.RADICALE_WALL_CALENDAR_PATH?.trim() ||
  '/home/vince/Projects/radicale/data/collections/collection-root/vince/wall'

type CalendarEvent = {
  id: string
  startAt: Date
  title: string
  description: string
}

type WallAgendaFeed = {
  status: 'live' | 'error'
  error: string | null
  items: AgendaItem[]
}

export async function getWallAgendaData(): Promise<WallAgendaFeed> {
  try {
    const events = await readWallCalendarEvents()

    if (events.length === 0) {
      return {
        status: 'error',
        error: 'Geen komende agenda-items beschikbaar',
        items: [],
      }
    }

    return {
      status: 'live',
      error: null,
      items: events.slice(0, DEFAULT_AGENDA_LIMIT).map((event) => ({
        id: event.id,
        dateIso: formatISO(event.startAt, { representation: 'date' }),
        dateLabel: formatAgendaDateLabel(event.startAt),
        time: format(event.startAt, 'HH:mm'),
        title: event.title,
        context: event.description || 'Geen extra toelichting.',
      })),
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Agenda ophalen mislukt',
      items: [],
    }
  }
}

async function readWallCalendarEvents() {
  const entries = await readdir(RADICALE_WALL_PATH, { withFileTypes: true })
  const now = new Date()

  const events = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ics'))
      .map(async (entry) => {
        const raw = await readFile(join(RADICALE_WALL_PATH, entry.name), 'utf8')

        return parseCalendarEvent(entry.name, raw)
      }),
  )

  return events
    .filter((event): event is CalendarEvent => event !== null)
    .filter((event) => isAfter(event.startAt, now))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
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

function parseCalendarEvent(filename: string, raw: string): CalendarEvent | null {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '')
  const title = matchIcsValue(unfolded, 'SUMMARY')
  const description = matchIcsValue(unfolded, 'DESCRIPTION')?.replace(/\\n/g, ' ') ?? ''
  const dtStart = matchIcsValue(unfolded, 'DTSTART')

  if (!title || !dtStart) {
    return null
  }

  const startAt = parse(dtStart, "yyyyMMdd'T'HHmmss", new Date())

  if (Number.isNaN(startAt.getTime())) {
    return null
  }

  return {
    id: filename.replace(/\.ics$/, ''),
    startAt,
    title,
    description,
  }
}

function matchIcsValue(input: string, key: string) {
  const match = input.match(new RegExp(`^${key}(?:;[^:]+)?:([^\\r\\n]+)$`, 'm'))

  return match?.[1]?.trim() ?? null
}

export type { WallAgendaFeed }
