import type { MetadataRoute } from 'next'

/** Crawling remains disabled until production SEO and legal acceptance. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
