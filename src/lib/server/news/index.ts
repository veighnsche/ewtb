import { createServerFn } from '@tanstack/react-start'

export const getWallNewsFeed = createServerFn({ method: 'GET' }).handler(async () => {
  const { getWallNewsFeedData } = await import('#/lib/server/news/service')

  return getWallNewsFeedData()
})
