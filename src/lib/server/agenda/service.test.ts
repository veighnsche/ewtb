import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWallAgendaData } from './service'

const collectorStateKey = '__ewtbAgendaCollectorState'

function buildXmlResponse(body: string, status = 207) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}

describe('getWallAgendaData', () => {
  const originalBaseUrl = process.env.CALDAV_BASE_URL
  const originalUsername = process.env.CALDAV_USERNAME
  const originalPassword = process.env.CALDAV_PASSWORD
  const originalTimezone = process.env.CALDAV_TIMEZONE

  beforeEach(() => {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
    process.env.CALDAV_BASE_URL = 'https://dav.test'
    process.env.CALDAV_USERNAME = 'vince'
    process.env.CALDAV_PASSWORD = 'secret'
    process.env.CALDAV_TIMEZONE = 'Europe/Paris'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    if (originalBaseUrl === undefined) {
      delete process.env.CALDAV_BASE_URL
    } else {
      process.env.CALDAV_BASE_URL = originalBaseUrl
    }

    if (originalUsername === undefined) {
      delete process.env.CALDAV_USERNAME
    } else {
      process.env.CALDAV_USERNAME = originalUsername
    }

    if (originalPassword === undefined) {
      delete process.env.CALDAV_PASSWORD
    } else {
      process.env.CALDAV_PASSWORD = originalPassword
    }

    if (originalTimezone === undefined) {
      delete process.env.CALDAV_TIMEZONE
    } else {
      process.env.CALDAV_TIMEZONE = originalTimezone
    }

    delete (globalThis as typeof globalThis & Record<string, unknown>)[collectorStateKey]
  })

  it('returns a loading snapshot while the first refresh runs, then serves the cached agenda', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === 'string' ? init.body : ''

      if (url === 'https://dav.test') {
        return buildXmlResponse(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
      <d:prop>
        <d:current-user-principal>
          <d:href>/users/vince/</d:href>
        </d:current-user-principal>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`)
      }

      if (url === 'https://dav.test/users/vince/') {
        return buildXmlResponse(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
      <d:prop>
        <c:calendar-home-set>
          <d:href>/users/vince/calendar/</d:href>
        </c:calendar-home-set>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`)
      }

      if (url === 'https://dav.test/users/vince/calendar/') {
        return buildXmlResponse(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/users/vince/calendar/events/</d:href>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
      <d:prop>
        <d:displayname>Events</d:displayname>
        <d:resourcetype>
          <d:collection/>
          <c:calendar/>
        </d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`)
      }

      if (url === 'https://dav.test/users/vince/calendar/events/') {
        if (body.includes('name="VEVENT"')) {
          await new Promise((resolve) => setTimeout(resolve, 300))

          return buildXmlResponse(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/users/vince/calendar/events/launch.ics</d:href>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
      <d:prop>
        <c:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Town hall
DTSTART:20300320T090000Z
DTEND:20300320T100000Z
DESCRIPTION:Main stage
END:VEVENT
END:VCALENDAR</c:calendar-data>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`)
        }

        if (body.includes('name="VTODO"')) {
          return buildXmlResponse(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/users/vince/calendar/events/follow-up.ics</d:href>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
      <d:prop>
        <c:calendar-data>BEGIN:VCALENDAR
BEGIN:VTODO
SUMMARY:Follow-up sturen
DUE:20300320T120000Z
DESCRIPTION:Bel de leverancier terug
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR</c:calendar-data>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`)
        }

        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = await getWallAgendaData()

    expect(first).toMatchObject({
      status: 'loading',
      error: null,
      updatedAt: null,
      stale: false,
      items: [],
      tasks: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 350))

    const second = await getWallAgendaData()

    expect(second.status).toBe('live')
    expect(second.stale).toBe(false)
    expect(second.items).toHaveLength(1)
    expect(second.items[0]).toMatchObject({
      title: 'Town hall',
      calendar: 'Events',
      context: 'Main stage',
    })
    expect(second.tasks).toHaveLength(1)
    expect(second.tasks[0]).toMatchObject({
      title: 'Follow-up sturen',
      calendar: 'Events',
      context: 'Bel de leverancier terug',
      statusLabel: 'Open',
    })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
