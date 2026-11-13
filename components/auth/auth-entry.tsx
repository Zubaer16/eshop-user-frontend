'use client'
import { SignInForm } from './sign-in-form'
export function AuthEntry({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <SignInForm key={mode} register={mode === 'sign-up'} />
}
