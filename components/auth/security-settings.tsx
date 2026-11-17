'use client'

import Link from '@/components/ui/app-link'
import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
} from 'lucide-react'
import { api, ApiRequestError } from '@/lib/api/client'

type PasswordFieldName = 'current' | 'new' | 'confirm'
type BusyAction = 'verification' | 'password' | null

type PasswordInputProps = {
  id: string
  label: string
  value: string
  autoComplete: string
  visible: boolean
  disabled: boolean
  invalid?: boolean
  describedBy?: string
  onChange: (value: string) => void
  onToggle: () => void
}

function PasswordInput({
  id,
  label,
  value,
  autoComplete,
  visible,
  disabled,
  invalid = false,
  describedBy,
  onChange,
  onToggle,
}: PasswordInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          className={`block h-12 w-full rounded-xl border bg-white px-3 pr-12 font-normal text-ink transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${invalid ? 'border-red-400' : 'border-slate-300'}`}
          type={visible ? 'text' : 'password'}
          required
          minLength={12}
          maxLength={128}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onToggle}
          disabled={disabled}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

function PasswordRequirement({
  met,
  invalid = false,
  label,
}: {
  met: boolean
  invalid?: boolean
  label: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${met ? 'text-emerald-700' : invalid ? 'text-red-700' : 'text-slate-500'}`}
    >
      {met ? (
        <CheckCircle2 size={14} />
      ) : invalid ? (
        <AlertCircle size={14} />
      ) : (
        <Circle size={14} />
      )}
      {label}
    </span>
  )
}

export function SecuritySettings() {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState<Record<PasswordFieldName, boolean>>({
    current: false,
    new: false,
    confirm: false,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const busy = busyAction !== null
  const passwordLengthValid = password.length >= 12
  const passwordIsDifferent =
    current.length > 0 && password.length > 0 && password !== current
  const passwordsMatch = confirm.length > 0 && password === confirm
  const confirmMismatch = confirm.length > 0 && password !== confirm

  function updatePasswordField(
    field: 'current' | 'new' | 'confirm',
    value: string,
  ) {
    if (field === 'current') setCurrent(value)
    if (field === 'new') setPassword(value)
    if (field === 'confirm') setConfirm(value)
    setError('')
    setMessage('')
  }

  function toggleVisibility(field: PasswordFieldName) {
    setVisible((previous) => ({ ...previous, [field]: !previous[field] }))
  }

  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    if (password.length < 12) {
      setError('Your new password must be at least 12 characters long.')
      return
    }
    if (password.length > 128) {
      setError('Your new password must be no more than 128 characters long.')
      return
    }
    if (password === current) {
      setError(
        'Choose a new password that is different from your current password.',
      )
      return
    }
    if (password !== confirm) {
      setError('The new password and confirmation do not match.')
      return
    }

    setBusyAction('password')
    setMessage('')
    setError('')
    try {
      await api.request('/v1/auth/change-password', {
        method: 'POST',
        refreshOn401: false,
        body: { currentPassword: current, newPassword: password },
      })
      setMessage(
        'Your password has been changed. Please sign in again with your new password.',
      )
      // The API revokes all existing sessions. Clear this browser session as well.
      await api.signOut().catch(() => undefined)
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : 'The password could not be changed. Please try again.',
      )
    } finally {
      setCurrent('')
      setPassword('')
      setConfirm('')
      setVisible({ current: false, new: false, confirm: false })
      setBusyAction(null)
    }
  }

  async function verify() {
    if (busy) return
    setBusyAction('verification')
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
          : 'The request could not be completed. Please try again.',
      )
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="container-shell max-w-xl py-10">
      <Link href="/account" className="text-sm font-bold text-primary">
        Back to your account
      </Link>
      <h1 className="mt-6 text-3xl font-black">Security settings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Keep your account secure by confirming your email and using a strong,
        unique password.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
          <p>{message}</p>
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary/40 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => void verify()}
          aria-busy={busyAction === 'verification'}
        >
          <Mail size={17} className="text-primary" />
          {busyAction === 'verification'
            ? 'Sending request…'
            : 'Request verification email'}
        </button>
        <p className="mt-2 text-xs leading-5 text-muted">
          We’ll send a secure verification link to the email address on your
          account when delivery is available.
        </p>
      </div>

      <div className="mt-9 border-t border-border pt-7">
        <div className="flex items-center gap-2">
          <KeyRound size={19} className="text-primary" />
          <h2 className="text-xl font-bold">Change password</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Changing your password signs you out of all sessions. You’ll need to
          sign in again with your new password.
        </p>

        <form className="mt-5 space-y-4" onSubmit={change}>
          <PasswordInput
            id="current-password"
            label="Current password"
            value={current}
            autoComplete="current-password"
            visible={visible.current}
            disabled={busy}
            onChange={(value) => updatePasswordField('current', value)}
            onToggle={() => toggleVisibility('current')}
          />

          <div>
            <PasswordInput
              id="new-password"
              label="New password"
              value={password}
              autoComplete="new-password"
              visible={visible.new}
              disabled={busy}
              describedBy="new-password-requirements"
              onChange={(value) => updatePasswordField('new', value)}
              onToggle={() => toggleVisibility('new')}
            />
            <div
              id="new-password-requirements"
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
            >
              <PasswordRequirement
                met={passwordLengthValid}
                invalid={password.length > 0 && !passwordLengthValid}
                label="At least 12 characters"
              />
              <PasswordRequirement
                met={passwordIsDifferent}
                invalid={
                  password.length > 0 &&
                  current.length > 0 &&
                  password === current
                }
                label="Different from current password"
              />
            </div>
          </div>

          <div>
            <PasswordInput
              id="confirm-new-password"
              label="Confirm new password"
              value={confirm}
              autoComplete="new-password"
              visible={visible.confirm}
              disabled={busy}
              invalid={confirmMismatch}
              describedBy="confirm-password-status"
              onChange={(value) => updatePasswordField('confirm', value)}
              onToggle={() => toggleVisibility('confirm')}
            />
            <p
              id="confirm-password-status"
              aria-live="polite"
              className={`mt-2 text-xs ${confirmMismatch ? 'text-red-700' : passwordsMatch ? 'text-emerald-700' : 'text-muted'}`}
            >
              {confirmMismatch
                ? 'Passwords do not match yet.'
                : passwordsMatch
                  ? 'Passwords match.'
                  : 'Re-enter your new password to confirm it.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={busyAction === 'password'}
          >
            {busyAction === 'password' ? 'Please wait…' : 'Change password'}
          </button>
        </form>
      </div>
    </section>
  )
}
