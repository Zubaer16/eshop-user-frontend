'use client'

import { useFinishCopy } from '@/hooks/use-finish-copy'
import Link from 'next/link'
import { ArrowRight, Globe2, MapPin, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
export default function AddressesPage() {
  const t = useFinishCopy()
  return (
    <section className="rounded-[22px] border border-border bg-white p-6 sm:p-8">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
        <MapPin size={27} />
      </div>
      <h2 className="mt-6 text-2xl font-black tracking-tight">
        {t.addressesTitle}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
        {t.addressesIntro}
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f6f9ff] p-5">
          <Globe2 size={20} className="text-primary" />
          <h3 className="mt-3 text-sm font-extrabold">{t.addressesMarkets}</h3>
          <p className="mt-2 text-xs leading-6 text-muted">
            {t.addressesMarketsDesc}
          </p>
        </div>
        <div className="rounded-2xl bg-[#f6f9ff] p-5">
          <ShieldCheck size={20} className="text-primary" />
          <h3 className="mt-3 text-sm font-extrabold">{t.addressesPrivacy}</h3>
          <p className="mt-2 text-xs leading-6 text-muted">
            {t.addressesPrivacyDesc}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/checkout">
          {t.addressesPreview} <ArrowRight size={16} />
        </Link>
      </Button>
    </section>
  )
}
