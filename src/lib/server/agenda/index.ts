import { createServerFn } from '@tanstack/react-start'

export const getWallAgenda = createServerFn({ method: 'GET' }).handler(async () => {
  const { getWallAgendaData } = await import('#/lib/server/agenda/service')

  return getWallAgendaData()
})
