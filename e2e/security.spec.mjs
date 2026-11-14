import { test, expect } from '@playwright/test'

test('production pages enforce security headers and block inline handlers and foreign scripts', async ({
  page,
}) => {
  let foreignRequests = 0
  await page.route('https://csp-audit.invalid/**', async (route) => {
    foreignRequests++
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.securityProbe = 1',
    })
  })
  await page.addInitScript(() => {
    window.securityProbe = 0
    window.securityViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.securityViolations.push(event.effectiveDirective)
    })
  })
  const response = await page.goto('/sign-in')
  const headers = response.headers()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  const policy = headers['content-security-policy']
  expect(policy).toContain("script-src-attr 'none'")
  expect(policy).toContain("frame-ancestors 'none'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).not.toContain("'unsafe-eval'")
  await expect(page.locator('input[type=email]')).toBeVisible()
  await page.evaluate(() => {
    const image = document.createElement('img')
    image.setAttribute('onerror', 'window.securityProbe = 1')
    image.src = '/missing-security-audit-image.png'
    const script = document.createElement('script')
    script.src = 'https://csp-audit.invalid/probe.js'
    document.body.append(image, script)
  })
  await expect
    .poll(() => page.evaluate(() => window.securityViolations))
    .toEqual(expect.arrayContaining(['script-src-attr', 'script-src-elem']))
  expect(await page.evaluate(() => window.securityProbe)).toBe(0)
  expect(foreignRequests).toBe(0)
})
