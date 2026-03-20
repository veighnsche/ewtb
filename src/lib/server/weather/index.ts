import { createServerFn } from '@tanstack/react-start'

export const getWallWeather = createServerFn({ method: 'GET' }).handler(async () => {
  const { getWallWeatherData } = await import('#/lib/server/weather/service')

  return getWallWeatherData()
})
