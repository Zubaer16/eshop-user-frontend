export function notificationTime(value: string, now = Date.now()) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Time unavailable'
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (seconds < 3600)
    return relative.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400)
    return relative.format(-Math.floor(seconds / 3600), 'hour')
  if (seconds < 604800)
    return relative.format(-Math.floor(seconds / 86400), 'day')
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date(now).getFullYear()
        ? undefined
        : 'numeric',
  }).format(date)
}

export function notificationBody(body: string) {
  return body.replace(
    /\b(order\s+)([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\b/gi,
    (_, label: string, id: string) =>
      label + '#' + id.slice(0, 8).toUpperCase(),
  )
}
