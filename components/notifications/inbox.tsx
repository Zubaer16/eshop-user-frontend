'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/client'
import {
  enableBrowserPush,
  revokeBrowserPush,
  pushConfigured,
} from '@/lib/api/browser-push'
import { useAuth } from '@/components/auth/auth-provider'
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
type Preferences = {
  revision: number
  securityEmailRequired: boolean
  transactionalInAppRequired: boolean
  [key: string]: number | boolean | string | null
}
const channels = [
  'transactionalEmail',
  'transactionalPush',
  'operationalInApp',
  'operationalEmail',
  'operationalPush',
  'marketingInApp',
  'marketingEmail',
  'marketingPush',
]
const button =
  'rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50'
export function NotificationInbox() {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { session } = useAuth(),
    router = useRouter(),
    [page, setPage] = useState(1),
    [unread, setUnread] = useState(false),
    [data, setData] = useState<Page | null>(null),
    [prefs, setPrefs] = useState<Preferences | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [delivery, setDelivery] = useState<string | null>(null)
  useEffect(() => {
    setDelivery(new URLSearchParams(window.location.search).get('delivery'))
  }, [])
  useEffect(() => {
    let active = true
    const c = new AbortController()
    setData(null)
    setError('')
    void Promise.all([
      api.request<Page>('/v1/notifications', {
        query: { page, limit: 20, readState: unread ? 'unread' : 'all' },
        signal: c.signal,
      }),
      api.request<Preferences>('/v1/notifications/preferences', {
        signal: c.signal,
      }),
    ])
      .then(([rows, p]) => {
        if (active) {
          setData(rows)
          setPrefs(p)
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
      c.abort()
    }
  }, [page, unread, revision])
  const epoch = session.epoch,
    subject = session.user?.id
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
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      guard()
      await work()
      guard()
      setRevision((v) => v + 1)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Action not confirmed. Refresh before retrying.',
      )
    } finally {
      setBusy(false)
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
    <section className="container-shell max-w-5xl space-y-5 py-10">
      <h1 className="text-3xl font-black">Your notification inbox</h1>
      <p className="text-sm text-muted">
        Account-owned messages. Security email and transactional in-app history
        remain mandatory. Marketing consent is separate from browser
        notification permission.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {delivery && (
        <button
          className={button}
          disabled={busy}
          onClick={() => void action(() => open(delivery, true))}
        >
          Open received push notification
        </button>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          className={button}
          onClick={() => setRevision((v) => v + 1)}
          disabled={busy}
        >
          Refresh inbox
        </button>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked)
              setPage(1)
            }}
          />{' '}
          Unread only
        </label>
        <button
          className={button}
          disabled={busy || !data}
          onClick={() =>
            void action(async () => {
              await api.request('/v1/notifications/read-all', {
                method: 'PUT',
                body: { before: new Date().toISOString() },
              })
              guard()
              setNotice('Messages through the selected time marked read.')
            })
          }
        >
          Mark current history read
        </button>
      </div>
      {data ? (
        <>
          <p>
            {data.unread} unread · {data.total} matching messages
          </p>
          {data.items.map((row) => (
            <article
              key={row.id}
              className="space-y-3 rounded-2xl border bg-white p-5"
            >
              <h2 className="font-bold">{row.title}</h2>
              <p className="whitespace-pre-wrap text-sm">{row.body}</p>
              <p className="text-xs text-muted">
                {row.createdAt} · {row.readAt ? 'Read' : 'Unread'}
              </p>
              <div className="flex gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api.request(
                        '/v1/notifications/' + row.id + '/read',
                        {
                          method: 'PUT',
                          body: { read: !row.readAt },
                        },
                      )
                    })
                  }
                >
                  {row.readAt ? 'Mark unread' : 'Mark read'}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void action(() => open(row.id))}
                >
                  Open message destination
                </button>
              </div>
            </article>
          ))}
          {!data.items.length && <p>No messages in this view.</p>}
          <div className="flex justify-between">
            <button
              className={button}
              disabled={busy || page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous messages
            </button>
            <span>
              Page {data.page} of {Math.max(1, data.pages)}
            </span>
            <button
              className={button}
              disabled={busy || page >= data.pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next messages
            </button>
          </div>
        </>
      ) : (
        !error && <p role="status">Loading inbox…</p>
      )}
      {prefs && (
        <form
          key={prefs.revision}
          className="space-y-4 rounded-2xl border bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            if (
              form.has('marketingEmail') ||
              form.has('marketingPush') ||
              form.has('marketingInApp')
            )
              if (
                !window.confirm(
                  'Allow the selected marketing channels for this account?',
                )
              )
                return
            void action(async () => {
              await api.request('/v1/notifications/preferences', {
                method: 'PUT',
                body: {
                  expectedRevision: prefs.revision,
                  ...Object.fromEntries(
                    channels.map((key) => [key, form.has(key)]),
                  ),
                },
              })
              guard()
              setNotice('Notification preferences saved.')
            })
          }}
        >
          <h2 className="text-xl font-bold">Notification preferences</h2>
          <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
            {channels.map((key) => (
              <label key={key} className="text-sm">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={prefs[key] === true}
                />{' '}
                {key.replace(/([a-z])([A-Z])/g, '$1 $2')}
              </label>
            ))}
          </fieldset>
          <button className={button} disabled={busy}>
            Save notification preferences
          </button>
        </form>
      )}
      <section className="space-y-3 rounded-2xl border p-5">
        <h2 className="text-xl font-bold">Browser push on this device</h2>
        <p className="text-sm text-muted">
          {pushConfigured()
            ? 'Enable only if you want notifications on this browser.'
            : 'Browser push configuration is unavailable on this deployment. In-app messages remain available.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className={button}
            disabled={busy || !pushConfigured()}
            onClick={() =>
              void action(async () => {
                await enableBrowserPush()
                guard()
                setNotice(
                  'This browser registration was confirmed. Provider delivery still depends on deployment configuration.',
                )
              })
            }
          >
            Enable or refresh browser push
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await revokeBrowserPush()
                guard()
                setNotice('This browser push registration was revoked.')
              })
            }
          >
            Revoke this browser push
          </button>
        </div>
        <DeviceList revision={revision} />
      </section>
    </section>
  )
}
function DeviceList({ revision }: { revision: number }) {
  const [rows, setRows] = useState<
      | {
          id: string
          surface: string
          status: string
          lastSeenAt: string
          expiresAt: string
        }[]
      | null
    >(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setRows(null)
    setError('')
    void api
      .request<typeof rows>('/v1/notifications/push/devices')
      .then((value) => {
        if (active) setRows(value)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [revision])
  return (
    <div className="space-y-2 text-xs">
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        rows?.map((row) => (
          <p key={row.id}>
            {row.surface} · {row.status} · last seen {row.lastSeenAt} · expires{' '}
            {row.expiresAt}
          </p>
        ))
      )}
    </div>
  )
}
