'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '@/lib/api/client'
export function RecoveryForm({
  mode,
}: {
  mode: 'forgot' | 'reset' | 'verify'
}) {
  const [token, setToken] = useState(''),
    [ready, setReady] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    const capture = () => {
      if (mode !== 'forgot') {
        const url = new URL(window.location.href),
          hasFragment = Boolean(url.hash)
        const candidate =
          new URLSearchParams(url.hash.slice(1)).get('token') || ''
        if (hasFragment) {
          setToken(/^[A-Za-z0-9_-]{40,128}$/.test(candidate) ? candidate : '')
          setDone(false)
          setError('')
          setPassword('')
          setConfirm('')
        }
        url.hash = ''
        url.searchParams.delete('token')
        window.history.replaceState(null, '', url.pathname + url.search)
      }
      setReady(true)
    }
    capture()
    window.addEventListener('hashchange', capture)
    return () => window.removeEventListener('hashchange', capture)
  }, [mode])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (mode === 'reset' && password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const route =
        mode === 'forgot'
          ? '/v1/auth/password-reset/request'
          : mode === 'reset'
            ? '/v1/auth/password-reset/confirm'
            : '/v1/auth/email-verification/confirm'
      const body =
        mode === 'forgot'
          ? { email: email.trim() }
          : mode === 'reset'
            ? { token, newPassword: password }
            : { token }
      await api.request(route, { method: 'POST', body, auth: false })
      if (mode === 'reset') await api.signOut()
      setDone(true)
      setToken('')
      setPassword('')
      setConfirm('')
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message +
              (e.retryAfterSeconds
                ? ` Try again in ${e.retryAfterSeconds} seconds.`
                : '')
          : 'The request could not be completed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto my-12 max-w-md rounded-3xl border border-slate-200 bg-white p-7">
      <h1 className="text-3xl font-black">
        {mode === 'forgot'
          ? 'Reset your password'
          : mode === 'reset'
            ? 'Choose a new password'
            : 'Verify your email'}
      </h1>
      {done ? (
        <>
          <p role="status" className="mt-5 text-sm text-slate-600">
            {mode === 'forgot'
              ? 'If an eligible account exists and delivery is available, a recovery link will be sent. Check your email.'
              : mode === 'reset'
                ? 'Your password was changed. Sign in again with your new password.'
                : 'Your email verification was accepted.'}
          </p>
          <Link href="/sign-in" className="mt-6 block font-bold text-primary">
            Sign in
          </Link>
        </>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-3 text-red-800"
            >
              {error}
            </p>
          )}
          {ready && mode !== 'forgot' && !token ? (
            <p role="alert" className="mt-5 text-sm text-slate-600">
              Open the secure link from your email. This link is missing or
              invalid.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'forgot' && (
                <label className="block text-sm font-bold">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={320}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy || !ready}
                    className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
                  />
                </label>
              )}
              {mode === 'reset' && (
                <>
                  <label className="block text-sm font-bold">
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy || !ready}
                      className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    Confirm new password
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={busy || !ready}
                      className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
                    />
                  </label>
                </>
              )}
              <button
                disabled={busy || !ready || (mode !== 'forgot' && !token)}
                type="submit"
                className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'forgot'
                    ? 'Send recovery link'
                    : mode === 'reset'
                      ? 'Reset password'
                      : 'Verify email'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
