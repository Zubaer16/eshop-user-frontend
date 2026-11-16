'use client'
import { useEffect, useRef, useState } from 'react'
import Link from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { PendingButton } from '@/components/ui/pending-button'
import { ContentSkeleton } from '@/components/ui/page-skeleton'
import { ArrowLeft, Bell, LockKeyhole, Monitor, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAccountResource } from '@/components/account/use-account-resource'
import { useAuth } from '@/components/auth/auth-provider'
import {
  currentBrowserPushInstallation,
  enableBrowserPush,
  revokeBrowserPush,
  pushConfigured,
} from '@/lib/api/browser-push'
import { notificationTime } from '@/lib/notification-format'
import { cn } from '@/lib/utils'

type Preferences = {
  revision: number
  securityEmailRequired: boolean
  transactionalInAppRequired: boolean
  [key: string]: number | boolean | string | null
}
type Device = {
  id: string
  installationId: string
  surface: string
  status: string
  lastSeenAt: string
  expiresAt: string
}
const groups = [
  {
    title: 'Order updates',
    description: 'Payment, delivery and other updates about your orders.',
    fields: [
      { key: 'transactionalEmail', label: 'Order updates by email' },
      { key: 'transactionalPush', label: 'Order updates by push notification' },
    ],
  },
  {
    title: 'Store updates',
    description: 'Service announcements and other store information.',
    fields: [
      { key: 'operationalInApp', label: 'Store updates in your inbox' },
      { key: 'operationalEmail', label: 'Store updates by email' },
      { key: 'operationalPush', label: 'Store updates by push notification' },
    ],
  },
  {
    title: 'Offers & promotions',
    description: 'Choose where you receive offers and product news.',
    fields: [
      { key: 'marketingInApp', label: 'Offers in your inbox' },
      { key: 'marketingEmail', label: 'Offers by email' },
      { key: 'marketingPush', label: 'Offers by push notification' },
    ],
  },
]
const saveButton =
  'inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50'

export function NotificationSettings() {
  const { session } = useAuth()
  const preferences = useAccountResource<Preferences>(
    '/v1/notifications/preferences',
  )
  const mounted = useRef(true)
  const writing = useRef(false)
  const [busy, setBusy] = useState<'preferences' | 'enable' | 'disable' | null>(
    null,
  )
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deviceRevision, setDeviceRevision] = useState(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const epoch = session.epoch
  const subject = session.user?.id
  function guard() {
    const current = api.getSnapshot()
    if (
      !mounted.current ||
      current.epoch !== epoch ||
      current.user?.id !== subject
    )
      throw new Error('The account changed. Reopen notification settings.')
  }
  async function action(
    kind: 'preferences' | 'enable' | 'disable',
    work: () => Promise<void>,
  ) {
    if (writing.current) return
    writing.current = true
    setBusy(kind)
    setError('')
    setNotice('')
    try {
      guard()
      await work()
      guard()
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Your changes could not be confirmed. Try again.',
        )
    } finally {
      writing.current = false
      if (mounted.current) setBusy(null)
    }
  }
  const prefs = preferences.data
  return (
    <section className="space-y-5">
      <Link
        href="/account/notifications"
        className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-primary hover:underline"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to inbox
      </Link>
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          Notification settings
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Choose the messages you receive and how we reach you.
        </p>
      </div>
      {(error || preferences.error) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p role="alert">{error || preferences.error}</p>
          {preferences.error && (
            <Button
              variant="outline"
              size="sm"
              onClick={preferences.reload}
              disabled={Boolean(busy) || preferences.loading}
            >
              Retry preferences
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-primary"
        >
          {notice}
        </p>
      )}
      {prefs ? (
        <form
          key={prefs.revision}
          className="rounded-[22px] border border-border bg-white"
          onSubmit={(event) => {
            event.preventDefault()
            if (writing.current || preferences.loading) return
            const form = new FormData(event.currentTarget)
            const channels = groups.flatMap((group) =>
              group.fields.map((field) => field.key),
            )
            if (
              channels.some(
                (key) => key.startsWith('marketing') && form.has(key),
              ) &&
              !window.confirm(
                'Allow the selected marketing channels for this account?',
              )
            )
              return
            void action('preferences', async () => {
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
              preferences.reload()
            })
          }}
        >
          <div className="flex gap-3 border-b border-border px-5 py-4 text-sm sm:px-6">
            <LockKeyhole
              size={17}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden="true"
            />
            <p className="leading-6 text-muted">
              Security emails and order history in your inbox are always
              enabled.
            </p>
          </div>
          <fieldset
            disabled={Boolean(busy) || preferences.loading}
            className="min-w-0 divide-y divide-border"
          >
            {groups.map((group) => (
              <section
                key={group.title}
                aria-label={group.title}
                className="px-5 py-5 sm:px-6"
              >
                <h3 className="text-sm font-extrabold text-ink">
                  {group.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {group.description}
                </p>
                <div className="mt-3 space-y-1">
                  {group.fields.map((field) => (
                    <label
                      key={field.key}
                      className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 text-sm text-ink"
                    >
                      <span>{field.label}</span>
                      <span className="relative inline-flex shrink-0">
                        <input
                          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                          type="checkbox"
                          role="switch"
                          name={field.key}
                          aria-label={field.label}
                          defaultChecked={prefs[field.key] === true}
                        />
                        <span
                          aria-hidden="true"
                          className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 peer-disabled:opacity-50"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </fieldset>
          <div className="flex justify-end border-t border-border px-5 py-4 sm:px-6">
            <PendingButton
              aria-label="Save notification preferences"
              busy={busy === 'preferences'}
              pendingLabel="Saving preferences…"
              className={saveButton}
              disabled={Boolean(busy) || preferences.loading}
            >
              Save changes
            </PendingButton>
          </div>
        </form>
      ) : !preferences.error ? (
        <ContentSkeleton
          variant="form"
          label="Loading notification preferences"
        />
      ) : null}
      <BrowserNotifications
        revision={deviceRevision}
        busy={busy}
        onEnable={() =>
          void action('enable', async () => {
            await enableBrowserPush()
            guard()
            setDeviceRevision((value) => value + 1)
            setNotice('Notifications are enabled for this browser.')
          })
        }
        onDisable={() =>
          void action('disable', async () => {
            await revokeBrowserPush()
            guard()
            setDeviceRevision((value) => value + 1)
            setNotice('Notifications are disabled for this browser.')
          })
        }
      />
    </section>
  )
}

function BrowserNotifications({
  revision,
  busy,
  onEnable,
  onDisable,
}: {
  revision: number
  busy: 'preferences' | 'enable' | 'disable' | null
  onEnable: () => void
  onDisable: () => void
}) {
  const [rows, setRows] = useState<Device[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const [installation, setInstallation] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setInstallation(currentBrowserPushInstallation())
    setPermission(
      'Notification' in window ? Notification.permission : 'unsupported',
    )
    void api
      .request<Device[]>('/v1/notifications/push/devices', {
        signal: controller.signal,
      })
      .then((value) => {
        if (active) setRows(value)
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
  }, [revision, reload])
  const current = rows?.find(
    (row) =>
      row.installationId === installation && row.surface === 'STOREFRONT',
  )
  const configured = pushConfigured()
  const enabled = current?.status === 'ACTIVE' && permission === 'granted'
  const status = loading
    ? 'Checking status…'
    : error
      ? 'Status unavailable'
      : !configured || permission === 'unsupported'
        ? 'Unavailable'
        : permission === 'denied'
          ? 'Blocked in browser'
          : enabled
            ? 'Enabled'
            : 'Not enabled'
  const browsers = rows?.filter((row) => row.surface === 'STOREFRONT') ?? []
  return (
    <section
      aria-label="Browser notifications"
      className="rounded-[22px] border border-border bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <Monitor size={17} aria-hidden="true" /> Browser notifications
        </h3>
        <span
          role="status"
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold',
            enabled
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-muted',
          )}
        >
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {!configured
          ? 'Browser notifications are currently unavailable.'
          : permission === 'denied'
            ? 'Allow notifications in your browser settings to enable them here.'
            : 'Receive updates on this browser, even when you’re away from the store.'}
      </p>
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <p role="alert" className="text-red-700">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(busy) || loading}
            onClick={() => setReload((value) => value + 1)}
          >
            Retry browser status
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <PendingButton
          busy={busy === 'enable'}
          pendingLabel="Enabling…"
          className={saveButton}
          disabled={
            Boolean(busy) ||
            !configured ||
            permission === 'unsupported' ||
            permission === 'denied'
          }
          onClick={onEnable}
        >
          {enabled ? (
            <>
              <RefreshCw size={14} className="mr-2" aria-hidden="true" />{' '}
              Refresh registration
            </>
          ) : (
            <>
              <Bell size={14} className="mr-2" aria-hidden="true" /> Enable
              notifications
            </>
          )}
        </PendingButton>
        <Button
          variant="outline"
          size="sm"
          disabled={Boolean(busy) || !installation}
          onClick={onDisable}
        >
          Disable for this browser
        </Button>
      </div>
      {browsers.length > 0 && (
        <details className="mt-5 border-t border-border pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-muted">
            Registered browsers ({browsers.length})
          </summary>
          <ul className="mt-3 divide-y divide-border">
            {browsers.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
              >
                <span>
                  <span className="font-semibold text-ink">
                    {row.installationId === installation
                      ? 'This browser'
                      : 'Other browser'}
                  </span>
                  <span className="mt-1 block text-muted">
                    Last active {notificationTime(row.lastSeenAt)}
                  </span>
                </span>
                <span className="text-muted">
                  {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
