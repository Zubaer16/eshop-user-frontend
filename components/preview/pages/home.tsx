'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Box,
  ChevronRight,
  Globe2,
  HeartHandshake,
  Sparkles,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryTile } from '@/components/store/category-tile'
import { CollectionTabs } from '@/components/store/collection-tabs'
import { categories } from '@/lib/catalog'
import { dictionary } from '@/lib/i18n'
import { finishCopy } from '@/lib/finish-copy'
import { useStoreReady } from '@/hooks/use-store-ready'

export default function HomePage() {
  const savedLocale = 'en' as const
  const ready = useStoreReady()
  const locale = ready ? savedLocale : 'en'
  const t = dictionary()
  const f = finishCopy(locale)
  return (
    <>
      <section className="container-shell pt-5 sm:pt-7">
        <div className="grid gap-4 lg:grid-cols-[1.78fr_1fr]">
          <div className="relative min-h-[470px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123fae] via-[#2459e8] to-[#6b8cfc] text-white sm:min-h-[480px]">
            <div className="pointer-events-none absolute -left-32 -top-32 size-[440px] rounded-full border-[70px] border-white/5" />
            <div className="relative z-10 flex h-full flex-col justify-center px-7 py-11 sm:w-[62%] sm:px-10 md:px-12 lg:w-[61%] xl:w-[58%]">
              <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[11px] font-extrabold tracking-wide">
                <Sparkles size={15} className="text-[#ffde8a]" />
                {t.discover}
              </span>
              <h1 className="max-w-xl text-[38px] font-black leading-[1.13] tracking-[-.05em] sm:text-[50px] lg:text-[46px] xl:text-[54px]">
                {t.heroTitle}
              </h1>
              <p className="mt-5 max-w-[350px] text-sm leading-7 text-[#e6edff] sm:text-[15px]">
                {t.heroText}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white bg-white text-primary hover:bg-[#edf2ff]"
                >
                  <Link href="/shop">
                    {t.shopNow}
                    <ArrowUpRight size={17} />
                  </Link>
                </Button>
                <Link
                  href="/categories"
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-white hover:underline"
                >
                  {f.homeExplore} <ArrowRight size={17} />
                </Link>
              </div>
              <p className="mt-10 flex items-center gap-2 text-xs font-medium text-white/75">
                <Globe2 size={15} /> {f.homeMarket}
              </p>
            </div>
            <div className="pointer-events-none absolute -bottom-8 -right-14 h-[285px] w-[320px] opacity-55 sm:bottom-2 sm:right-0 sm:h-[410px] sm:w-[43%] sm:opacity-100 lg:-right-5 lg:w-[44%] xl:w-[48%]">
              <Image
                src="/illustrations/hero.svg"
                alt="Curated lifestyle products"
                fill
                priority
                className="object-contain object-bottom"
              />
            </div>
            <div
              aria-hidden="true"
              className="absolute bottom-5 left-8 z-10 flex gap-1.5 sm:bottom-6 sm:left-12"
            >
              <span className="h-1.5 w-8 rounded-full bg-white" />
              <span className="size-1.5 rounded-full bg-white/40" />
              <span className="size-1.5 rounded-full bg-white/40" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/shop?category=footwear"
              className="group relative min-h-[215px] overflow-hidden rounded-[26px] bg-[#f0eafc] p-7 lg:min-h-0"
            >
              <div className="relative z-10 max-w-[64%]">
                <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#7862b5]">
                  {f.shoesEyebrow}
                </p>
                <h2 className="mt-3 text-[25px] font-black leading-[1.15] tracking-[-.04em] text-[#42346e]">
                  {f.shoesTitle}
                </h2>
                <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#69519e] group-hover:underline">
                  {f.shoesLink} <ArrowRight size={15} />
                </span>
              </div>
              <Image
                src="/products/loafers.svg"
                alt="Everyday loafers"
                width={214}
                height={214}
                className="absolute -bottom-11 -right-12 size-[205px] object-contain transition duration-300 group-hover:scale-105 sm:-right-10 lg:-right-8"
              />
            </Link>
            <Link
              href="/shop?category=fashion"
              className="group relative min-h-[215px] overflow-hidden rounded-[26px] bg-[#faecdf] p-7 lg:min-h-0"
            >
              <div className="relative z-10 max-w-[64%]">
                <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#aa754e]">
                  {f.fashionEyebrow}
                </p>
                <h2 className="mt-3 text-[25px] font-black leading-[1.15] tracking-[-.04em] text-[#75462d]">
                  {f.fashionTitle}
                </h2>
                <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#976039] group-hover:underline">
                  Shop fashion <ArrowRight size={15} />
                </span>
              </div>
              <Image
                src="/products/tshirt.svg"
                alt="Cotton T-shirt"
                width={213}
                height={213}
                className="absolute -bottom-12 -right-9 size-[205px] object-contain transition duration-300 group-hover:scale-105"
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="container-shell pt-10 sm:pt-12">
        <div className="grid gap-3 rounded-[22px] border border-border bg-[#fbfcff] p-5 sm:grid-cols-3 sm:gap-5 sm:px-7 sm:py-6">
          {[
            {
              icon: Box,
              title: f.highlight1,
              text: f.highlight1Desc,
            },
            {
              icon: HeartHandshake,
              title: f.highlight2,
              text: f.highlight2Desc,
            },
            {
              icon: BadgeCheck,
              title: f.highlight3,
              text: f.highlight3Desc,
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ecf2ff] text-primary">
                <Icon size={20} />
              </span>
              <span>
                <strong className="block text-xs font-extrabold sm:text-sm">
                  {title}
                </strong>
                <span className="mt-1 block text-xs text-muted">{text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="container-shell pb-4 pt-14 sm:pt-[72px]">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
              {f.categoryEyebrow}
            </p>
            <h2 className="section-heading">{t.shopByCategory}</h2>
            <p className="mt-2 text-sm text-muted">{t.categorySubtitle}</p>
          </div>
          <Link
            href="/categories"
            className="hidden items-center gap-2 text-sm font-extrabold text-primary hover:underline sm:inline-flex"
          >
            {f.categoryLink} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7 sm:gap-4">
          {categories.map((category) => (
            <CategoryTile category={category} key={category.id} />
          ))}
        </div>
        <div className="mt-5 text-center sm:hidden">
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary"
            href="/categories"
          >
            {f.categoryMobile} <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="container-shell pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
              {f.collectionEyebrow}
            </p>
            <h2 className="section-heading">{f.collectionTitle}</h2>
            <p className="mt-2 text-sm text-muted">{f.collectionDesc}</p>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-2 text-sm font-extrabold text-primary hover:underline sm:inline-flex"
          >
            {t.viewAll} <ArrowRight size={16} />
          </Link>
        </div>
        <CollectionTabs />
      </section>

      <section className="container-shell pb-16 sm:pb-20">
        <div className="grid overflow-hidden rounded-[27px] bg-[#152039] text-white lg:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden px-8 py-12 sm:px-14 sm:py-16">
            <div className="pointer-events-none absolute -left-20 -bottom-40 size-80 rounded-full border-[58px] border-white/5" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-extrabold text-[#ffdf9b]">
                <Tag size={14} /> {f.promoEyebrow}
              </div>
              <h2 className="mt-5 max-w-lg text-3xl font-black tracking-[-.04em] sm:text-4xl">
                {f.promoTitle}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-[#bac6dc]">
                {f.promoDesc}
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-7 border-white bg-white text-[#152039] hover:bg-[#e8efff]"
              >
                <Link href="/shop?tag=sale">
                  {f.promoLink} <ChevronRight size={17} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden min-h-[290px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#384e83] to-[#677fb9] lg:flex">
            <div className="absolute -right-20 -top-24 size-[340px] rounded-full border-[58px] border-white/10" />
            <Image
              src="/products/bottle.svg"
              alt="Insulated everyday bottle"
              width={270}
              height={270}
              className="relative size-[260px] drop-shadow-2xl"
            />
          </div>
        </div>
      </section>
    </>
  )
}
