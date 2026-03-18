import { createServerFn } from '@tanstack/react-start'

export const getWallCollector = createServerFn({ method: 'GET' }).handler(async () => {
  const { getWallCollectorData } = await import('#/lib/server/wall/service')

  return getWallCollectorData()
})
