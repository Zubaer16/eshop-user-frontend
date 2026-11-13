'use client'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  return (
    <div className="container-shell grid min-h-[65vh] items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
      <section className="mx-auto w-full max-w-[470px]">
        <Link
          href="/shop"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to shopping
        </Link>
        <div className="rounded-[26px] border border-border bg-white p-6 shadow-[0_18px_60px_rgba(21,32,57,.07)] sm:p-9">
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            {register ? <UserPlus size={24} /> : <LockKeyhole size={24} />}
          </div>
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
              disabled={
                busy || !mounted || !ready || session.status === 'checking'
              }
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
        </div>
      </section>
      <aside
        aria-label="Account benefits"
        className="hidden min-h-[530px] flex-col justify-center overflow-hidden rounded-[32px] bg-[#ecf2ff] p-11 lg:flex"
      >
        <Logo />
        <div className="my-9 flex size-20 items-center justify-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/15">
          <ShieldCheck size={38} />
        </div>
        <h2 className="max-w-md text-[34px] font-black leading-tight tracking-tight text-[#142a57]">
          Your everyday discoveries, all in one place.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-7 text-[#55698b]">
          Save your favorites, keep your delivery details close and follow your
          orders from your account.
        </p>
        <div className="mt-8 space-y-3">
          {[
            'Your saved favorites',
            'Delivery addresses in one place',
            'Order history and updates',
          ].map((item) => (
            <p
              key={item}
              className="flex items-center gap-3 text-sm font-bold text-[#25446f]"
            >
              <CheckCircle2 size={19} className="text-primary" />
              {item}
            </p>
          ))}
        </div>
      </aside>
    </div>
  )
}
