'use client'
import Link from 'next/link'
import { ArrowRight, Globe2, LockKeyhole, Settings2 } from 'lucide-react'
import { useUiCopy } from '@/hooks/use-ui-copy'
export default function AccountSettingsPage() {
  const t = useUiCopy()
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight">
          {t.shoppingPreferences}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t.preferencesIntro}
        </p>
      </div>
      <div className="rounded-[22px] border border-border bg-white p-5 sm:p-7">
        <div className="grid gap-6">
          <div className="rounded-xl border border-border bg-blue-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Globe2 size={18} className="text-primary" /> Currency
            </h3>
            <p className="mt-2 text-sm text-muted">
              All storefront prices and checkout examples are shown in USD ($),
              for all destinations.
            </p>
            <p className="mt-2 text-xs text-muted">
              Select a delivery destination during checkout. Real availability
              and shipping rates are not yet enabled.
            </p>
          </div>
        </div>
        <p className="mt-5 text-xs leading-6 text-muted">
          Product prices, taxes, and shipping remain illustrative until a
          verified backend is connected.
        </p>
      </div>
      <div className="rounded-[22px] border border-border bg-[#fbfcff] p-6">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          <LockKeyhole size={19} className="text-primary" /> {t.securityProfile}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">{t.securityIntro}</p>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          {t.seeSignin} <ArrowRight size={16} />
        </Link>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Settings2 size={15} /> Cart and wishlist are saved locally on this
        device.
      </p>
    </section>
  )
}
