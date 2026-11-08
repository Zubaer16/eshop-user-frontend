'use client'
import Link from 'next/link'
import { useState } from 'react'
import { api, ApiRequestError } from '@/lib/api/client'
export function SecuritySettings() {
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function change(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.request('/v1/auth/change-password', {
        method: 'POST',
        refreshOn401: false,
        body: { currentPassword: current, newPassword: password },
      })
      await api.signOut()
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : 'The password could not be changed.',
      )
    } finally {
      setCurrent('')
      setPassword('')
      setConfirm('')
      setBusy(false)
    }
  }
  async function verify() {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.request('/v1/auth/email-verification/request', {
        method: 'POST',
      })
      setMessage(
        'Verification requested. If email delivery is available, use the secure link sent to your address.',
      )
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : 'The request could not be completed.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="container-shell max-w-xl py-10">
      <Link href="/account" className="text-sm font-bold text-primary">
        Back to your account
      </Link>
      <h1 className="mt-6 text-3xl font-black">Security settings</h1>
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-5 rounded-xl bg-blue-50 p-3">
          {message}
        </p>
      )}
      <button
        className="mt-6 rounded-xl border border-slate-300 px-4 py-3 font-semibold disabled:opacity-50"
        disabled={busy}
        onClick={() => {
          void verify()
        }}
      >
        Request verification email
      </button>
      <h2 className="mt-9 text-xl font-bold">Change password</h2>
      <p className="mt-2 text-sm text-slate-600">
        Changing your password signs you out of all sessions.
      </p>
      <form className="mt-5 space-y-4" onSubmit={change}>
        {[
          ['Current password', current, setCurrent, 'current-password'],
          ['New password', password, setPassword, 'new-password'],
          ['Confirm new password', confirm, setConfirm, 'new-password'],
        ].map(([label, value, setter, autocomplete]) => (
          <label key={label as string} className="block text-sm font-bold">
            {label as string}
            <input
              className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={autocomplete as string}
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              disabled={busy}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Please wait…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
