'use client'
import Link from '@/components/ui/app-link'
import { Button, buttonVariants } from '@/components/ui/button'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { useNavigationRouter } from '@/components/layout/navigation-provider'
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Mail,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api/client'
import { notificationBody, notificationTime } from '@/lib/notification-format'
import { useAuth } from '@/components/auth/auth-provider'
import { cn } from '@/lib/utils'

type Row = {
  id: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}
type Page = {
  items: Row[]
  total: number
  unread: number
  page: number
  pages: number
}

export function NotificationInbox() {
  const mounted = useRef(true)
  const writing = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { session } = useAuth()
  const router = useNavigationRouter()
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(false)
  const [data, setData] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [delivery, setDelivery] = useState<string | null>(null)
  useEffect(() => {
    setDelivery(new URLSearchParams(window.location.search).get('delivery'))
  }, [])
  const queryKey =
    session.epoch + ':' + session.user?.id + ':' + page + ':' + unread
  const previousQuery = useRef(queryKey)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    if (previousQuery.current !== queryKey) setData(null)
    previousQuery.current = queryKey
    setLoading(true)
    setError('')
    void api
      .request<Page>('/v1/notifications', {
        query: { page, limit: 20, readState: unread ? 'unread' : 'all' },
        signal: controller.signal,
      })
      .then((rows) => {
        if (!active) return
        if (page > Math.max(1, rows.pages)) {
          setPage(Math.max(1, rows.pages))
          return
        }
        setData(rows)
      })
      .catch((failure) => {
        if (active) setError(failure.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [page, unread, revision, queryKey])
  const epoch = session.epoch
  const subject = session.user?.id
  function guard() {
    const current = api.getSnapshot()
    if (
      !mounted.current ||
      current.epoch !== epoch ||
      current.user?.id !== subject
    )
      throw new Error('The account changed. Reopen inbox.')
  }
  async function action(work: () => Promise<void>) {
    if (writing.current) return
    writing.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      guard()
      await work()
      guard()
      setRevision((value) => value + 1)
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Action not confirmed. Refresh before retrying.',
        )
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function open(id: string, push = false) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
      throw new Error('Invalid notification identifier.')
    const target = await api.request<{ path: string; surface: string }>(
      push
        ? '/v1/notifications/push/deliveries/' + id + '/navigation'
        : '/v1/notifications/' + id + '/navigation',
    )
    guard()
    const expected = session.user?.role === 'CUSTOMER' ? 'STOREFRONT' : 'ADMIN'
    if (
      target.surface !== expected ||
      !/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(target.path) ||
      /(?:\.\.|%2f|%5c|%25|\\)/i.test(target.path)
    )
      throw new Error('Notification destination is unavailable.')
    router.push(target.path)
  }
  return (
    <section className="space-y-5" aria-label="Notification inbox">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            Inbox
          </h2>
          {data && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
              {data.unread} unread
            </span>
          )}
        </div>
        <Link
          href="/account/notification-settings"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Settings2 size={15} aria-hidden="true" /> Notification settings
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-primary"
        >
          {notice}
        </p>
      )}
      {delivery && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void action(() => open(delivery, true))}
        >
          Open received push notification
        </Button>
      )}
      <div className="rounded-[22px] border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div
            role="group"
            aria-label="Message filter"
            className="inline-flex gap-1 rounded-xl bg-slate-100 p-1"
          >
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={unread === value}
                disabled={busy}
                onClick={() => {
                  setUnread(value)
                  setPage(1)
                }}
                className={cn(
                  'min-h-9 rounded-lg px-4 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50',
                  unread === value
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                {value ? 'Unread' : 'All'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || !data?.unread}
              onClick={() =>
                void action(async () => {
                  await api.request('/v1/notifications/read-all', {
                    method: 'PUT',
                    body: { before: new Date().toISOString() },
                  })
                  guard()
                  setNotice('All current messages marked as read.')
                })
              }
            >
              <CheckCheck size={15} aria-hidden="true" /> Mark all as read
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={loading ? 'Refreshing inbox…' : 'Refresh inbox'}
              disabled={busy || loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={
                  loading ? 'animate-spin motion-reduce:animate-none' : ''
                }
              />
            </Button>
          </div>
        </div>
        {data ? (
          <div className="divide-y divide-border">
            {data.items.map((row) => (
              <article
                key={row.id}
                className={cn(
                  'relative flex gap-1 pr-2 last:rounded-b-[22px] sm:pr-3',
                  !row.readAt && 'bg-blue-50/50',
                )}
              >
                <button
                  type="button"
                  disabled={busy}
                  aria-label={'Open notification: ' + row.title}
                  onClick={() => void action(() => open(row.id))}
                  className="flex min-w-0 flex-1 gap-3 p-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:opacity-60 sm:gap-4 sm:p-5"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-primary">
                    <Bell size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2 text-sm font-bold text-ink">
                      {row.title}
                      {!row.readAt && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary">
                          <span className="sr-only">Unread</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-6 text-muted">
                      {notificationBody(row.body)}
                    </span>
                    <time
                      dateTime={row.createdAt}
                      title={new Date(row.createdAt).toLocaleString()}
                      className="mt-2 block text-xs text-muted"
                    >
                      {notificationTime(row.createdAt)}
                    </time>
                  </span>
                </button>
                <details className="relative mt-3 shrink-0 self-start">
                  <summary
                    aria-label={'Message options for ' + row.title}
                    className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-muted hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
                  >
                    <Ellipsis size={18} aria-hidden="true" />
                  </summary>
                  <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-border bg-white p-1.5 shadow-lg">
                    <button
                      type="button"
                      disabled={busy}
                      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
                      onClick={(event) => {
                        event.currentTarget
                          .closest('details')
                          ?.removeAttribute('open')
                        void action(async () => {
                          await api.request(
                            '/v1/notifications/' + row.id + '/read',
                            { method: 'PUT', body: { read: !row.readAt } },
                          )
                        })
                      }}
                    >
                      <Mail size={15} aria-hidden="true" />
                      {row.readAt ? 'Mark unread' : 'Mark read'}
                    </button>
                  </div>
                </details>
              </article>
            ))}
            {!data.items.length && (
              <div className="flex flex-col items-center px-5 py-14 text-center">
                <Bell
                  size={28}
                  strokeWidth={1.4}
                  className="mb-4 text-muted"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-bold text-ink">
                  {unread ? 'You’re all caught up' : 'No notifications yet'}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {unread
                    ? 'Your new messages will appear here.'
                    : 'Order and account updates will appear here.'}
                </p>
              </div>
            )}
          </div>
        ) : !error ? (
          <div className="p-5">
            <ContentSkeleton variant="list" label="Loading inbox" />
          </div>
        ) : null}
        {data && data.pages > 1 && (
          <nav
            aria-label="Message pages"
            className="flex items-center justify-between border-t border-border p-4"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={busy || loading || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={15} /> Previous
            </Button>
            <span className="text-xs text-muted">
              {data.page} / {data.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || loading || page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next <ChevronRight size={15} />
            </Button>
          </nav>
        )}
      </div>
    </section>
  )
}
