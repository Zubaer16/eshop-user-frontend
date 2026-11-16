'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Check, LoaderCircle, LockKeyhole } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CheckoutStage =
  'preparing' | 'recovery' | 'start' | 'session' | 'redirect'

const messages: Record<CheckoutStage, string> = {
  preparing: 'Preparing checkout…',
  recovery: 'Checking for an existing checkout…',
  start: 'Checking stock, reserving items and preparing payment…',
  session: 'Preparing your secure payment session…',
  redirect: 'Opening Stripe Checkout…',
}

export function CheckoutProgress({ stage }: { stage: CheckoutStage }) {
  const current =
    stage === 'redirect' ? 2 : stage === 'start' || stage === 'session' ? 1 : 0
  const steps = [
    {
      title: 'Reviewing your checkout',
      description: 'Checking for an existing order or stock reservation.',
    },
    stage === 'session'
      ? {
          title: 'Preparing secure payment',
          description: 'Resuming the payment session for your reserved order.',
        }
      : {
          title: 'Confirming stock and payment',
          description:
            'Checking availability and prices, reserving your items and preparing secure payment.',
        },
    {
      title: 'Opening Stripe Checkout',
      description: 'Connecting you to Stripe to complete your payment.',
    },
  ]

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-[#101a35]/45 backdrop-blur-[3px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[120] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-border bg-white p-6 shadow-2xl outline-none sm:p-8"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <LockKeyhole size={23} aria-hidden="true" />
          </div>
          <Dialog.Title className="text-2xl font-extrabold tracking-tight text-ink">
            Preparing your checkout
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted">
            You’ll continue to Stripe when your checkout is ready.
          </Dialog.Description>
          <p role="status" aria-live="polite" className="sr-only">
            {messages[stage]}
          </p>
          <div
            role="progressbar"
            aria-label="Preparing Stripe Checkout"
            aria-valuetext={messages[stage]}
            className="checkout-progress mb-7 mt-5"
          >
            <span />
          </div>
          <ol aria-label="Payment preparation steps">
            {steps.map((step, index) => {
              const complete = index < current
              const active = index === current
              const status = complete
                ? 'Completed'
                : active
                  ? 'In progress'
                  : 'Waiting'
              return (
                <li
                  key={index}
                  aria-current={active ? 'step' : undefined}
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-2 left-3 top-8 w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                      complete
                        ? 'bg-emerald-600 text-white'
                        : active
                          ? 'text-primary'
                          : 'border-2 border-border bg-white',
                    )}
                  >
                    {complete && <Check size={15} strokeWidth={3} />}
                    {active && (
                      <LoaderCircle
                        size={24}
                        className="animate-spin motion-reduce:animate-none"
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2
                      className={cn(
                        'text-sm font-extrabold sm:text-base',
                        active || complete ? 'text-ink' : 'text-muted',
                      )}
                    >
                      {step.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted">
                      {step.description}
                    </p>
                    <span
                      className={cn(
                        'mt-2.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold',
                        complete
                          ? 'bg-emerald-50 text-emerald-700'
                          : active
                            ? 'bg-blue-50 text-primary'
                            : 'bg-slate-100 text-muted',
                      )}
                    >
                      {status}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
