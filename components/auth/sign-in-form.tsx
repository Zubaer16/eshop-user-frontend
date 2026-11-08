'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPreviewMode } from '@/lib/integration-mode'
import { api, ApiRequestError, safeReturnTo } from '@/lib/api/client'
import { useAuth } from '@/components/auth/auth-provider'
export function SignInForm({
  register = false,
  staff = false,
}: {
  register?: boolean
  staff?: boolean
}) {
  const { session, ready } = useAuth(),
    router = useRouter()
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [returnPath, setReturnPath] = useState(
    staff ? '/dashboard' : '/account',
  )
  useEffect(() => {
    setReturnPath(
      safeReturnTo(
        new URLSearchParams(window.location.search).get('next'),
        staff ? '/dashboard' : '/account',
      ),
    )
  }, [staff])
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    if (ready && session.status === 'authenticated') {
      router.replace(
        safeReturnTo(
          new URLSearchParams(window.location.search).get('next'),
          staff ? '/dashboard' : '/account',
        ),
      )
    }
  }, [session.status, ready, router, staff])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (register && password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.signIn({ email: email.trim(), password }, register)
      setPassword('')
      setConfirm('')
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message +
              (e.retryAfterSeconds
                ? ` Try again in ${e.retryAfterSeconds} seconds.`
                : '')
          : 'Sign-in could not be completed.',
      )
      setPassword('')
      setConfirm('')
    } finally {
      setBusy(false)
    }
  }
  if (isPreviewMode)
    return (
      <section className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-black">Preview mode</h1>
        <p className="mt-3">Authentication is disabled in this preview.</p>
        <Link href="/">Open preview</Link>
      </section>
    )
  return (
    <section className="mx-auto my-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <Link href="/" className="text-xl font-black text-primary">
        eShop{staff ? ' Admin' : ''}
      </Link>
      <h1 className="mt-7 text-3xl font-black">
        {register
          ? 'Create your account'
          : staff
            ? 'Admin sign in'
            : 'Welcome back'}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {staff
          ? 'Sign in with an existing staff account.'
          : register
            ? 'Use your email and a password of at least 12 characters.'
            : 'Sign in to your customer account.'}
      </p>
      {session.notice && (
        <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm">
          {session.notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-bold">
          Email
          <input
            className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
            type="email"
            autoComplete="username"
            maxLength={320}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || !mounted}
          />
        </label>
        <label className="block text-sm font-bold">
          Password
          <input
            className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || !mounted}
          />
        </label>
        {register && (
          <label className="block text-sm font-bold">
            Confirm password
            <input
              className="mt-2 block h-12 w-full rounded-xl border border-slate-300 px-3 font-normal"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy || !mounted}
            />
          </label>
        )}
        <button
          className="h-12 w-full rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-50"
          disabled={busy || !mounted || !ready || session.status === 'checking'}
          type="submit"
        >
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {!staff && (
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm font-semibold text-primary">
          <Link
            href={
              (register ? '/sign-in' : '/sign-up') +
              '?next=' +
              encodeURIComponent(returnPath)
            }
          >
            {register
              ? 'Already have an account? Sign in'
              : 'Create an account'}
          </Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
      )}
    </section>
  )
}
