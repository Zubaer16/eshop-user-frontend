'use client'
import { api } from './client'
import { createPublicCache } from '../public-cache'

export const publicData = createPublicCache()
export function readPublic<T>(
  route: string,
  query: Record<string, string | number | boolean | undefined> = {},
  force = false,
) {
  // A component unmount must not cancel another component's shared request.
  // The existing API transport still owns timeouts; consumers fence late results.
  return publicData.get<T>(
    route,
    query,
    () => api.request<T>(route, { auth: false, query }),
    force,
  )
}
