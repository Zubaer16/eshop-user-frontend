import { test, expect } from '@playwright/test'

async function openControlled(page, path) {
  await page.goto(path)
  if (path === '/')
    await page
      .getByRole('button', { name: 'Refresh featured content', exact: true })
      .click()
  if (path === '/shop')
    await page
      .getByRole('button', { name: 'Refresh products', exact: true })
      .click()
}

async function openControlledCategories(page, path) {
  const clockStart = Date.now()
  await page.clock.setFixedTime(clockStart)
  await openControlled(page, path)
  // Expire the public server snapshot and use the normal focus revalidation.
  await page.clock.setFixedTime(clockStart + 60000)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

test('returning to public pages reuses catalog and homepage data without another fetch', async ({
  page,
}) => {
  await mock(page)
  let productReads = 0,
    homeReads = 0
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') return
    if (path === '/v1/products') productReads++
    if (path === '/v1/store/homepage') homeReads++
  })
  await openControlled(page, '/')
  await expect(
    page.getByRole('heading', { name: 'Discover something new', exact: true }),
  ).toBeVisible()
  const firstHomeReads = homeReads
  await page
    .locator('footer')
    .getByRole('link', { name: 'Shop all', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Refresh products', exact: true })
    .click()
  await expect(page.locator('main article')).toHaveCount(10)
  const firstProductReads = productReads
  await page
    .locator('footer')
    .getByRole('link', { name: 'All categories', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Shop by category', exact: true }),
  ).toBeVisible()
  await page
    .locator('footer')
    .getByRole('link', { name: 'Shop all', exact: true })
    .click()
  await expect(page.locator('main article')).toHaveCount(10)
  expect(productReads).toBe(firstProductReads)
  await page
    .locator('header')
    .getByRole('link', { name: 'eShop home', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Discover something new', exact: true }),
  ).toBeVisible()
  expect(homeReads).toBe(firstHomeReads)
})

test('slow search navigation shows progress and clears it on a query-only commit', async ({
  page,
}) => {
  await mock(page)
  let release,
    requested = false
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/shop?**', async (route) => {
    const url = new URL(route.request().url())
    if (
      url.searchParams.get('q') === 'navigation-probe' &&
      route.request().headers().rsc === '1'
    ) {
      requested = true
      await gate
    }
    await route.continue().catch(() => {})
  })
  try {
    await openControlled(page, '/shop')
    await page
      .getByRole('textbox', { name: 'Search the catalog', exact: true })
      .fill('navigation-probe')
    await page
      .getByRole('button', { name: 'Submit search', exact: true })
      .click()
    await expect.poll(() => requested).toBe(true)
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    release()
    await expect(page).toHaveURL(/shop\?q=navigation-probe/)
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toHaveCount(0)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('native Link pending signals show progress during a slow route request', async ({
  page,
}) => {
  await mock(page)
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/shop?**', async (route) => {
    if (route.request().headers().rsc === '1') await gate
    await route.continue().catch(() => {})
  })
  try {
    await openControlled(page, '/')
    await page
      .locator('header')
      .getByRole('link', { name: 'Shop', exact: true })
      .click()
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath('navigation-pending.png'),
    })
    release()
    await expect(page).toHaveURL(/\/shop$/)
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toHaveCount(0)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('a newer cached navigation clears progress while an older request is still delayed', async ({
  page,
}) => {
  await mock(page)
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await openControlled(page, '/')
  await page
    .locator('footer')
    .getByRole('link', { name: 'All categories', exact: true })
    .click()
  await expect(page).toHaveURL(/\/categories$/)
  await page
    .locator('header')
    .getByRole('link', { name: 'eShop home', exact: true })
    .click()
  await page.route('**/shop?**', async (route) => {
    if (
      new URL(route.request().url()).searchParams.get('q') === 'cancelled-probe'
    )
      await gate
    await route.continue().catch(() => {})
  })
  try {
    await page
      .getByRole('textbox', { name: 'Search the catalog', exact: true })
      .fill('cancelled-probe')
    await page
      .getByRole('button', { name: 'Submit search', exact: true })
      .click()
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toBeVisible()
    await page
      .locator('footer')
      .getByRole('link', { name: 'All categories', exact: true })
      .click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toHaveCount(0)
    release()
    await expect(
      page.getByRole('heading', { name: 'Shop by category', exact: true }),
    ).toBeVisible()
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('cached route changes avoid a progress flash and history and hash navigation finish cleanly', async ({
  page,
}) => {
  await mock(page)
  await openControlled(page, '/')
  await page
    .locator('footer')
    .getByRole('link', { name: 'All categories', exact: true })
    .click()
  await expect(page).toHaveURL(/\/categories$/)
  await page
    .locator('header')
    .getByRole('link', { name: 'eShop home', exact: true })
    .click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(() => {
    window.progressFlashes = 0
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('[role=progressbar]') ||
              node.querySelector('[role=progressbar]'))
          )
            window.progressFlashes++
        }
    }).observe(document.body, { childList: true, subtree: true })
  })
  await page
    .locator('footer')
    .getByRole('link', { name: 'All categories', exact: true })
    .click()
  await expect(page).toHaveURL(/\/categories$/)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.progressFlashes)).toBe(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/categories$/)
  await page.getByRole('link', { name: 'Skip to content', exact: true }).focus()
  await page
    .getByRole('link', { name: 'Skip to content', exact: true })
    .press('Enter')
  await expect(page).toHaveURL(/#main-content$/)
  await page.waitForTimeout(300)
  await expect(
    page.getByRole('progressbar', { name: 'Loading page', exact: true }),
  ).toHaveCount(0)
})

test('pending profile save has stable button width, blocks duplicate clicks and keeps the form visible', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let release,
    writes = 0,
    displayName = 'Before save'
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/account/profile', async (route) => {
    if (route.request().method() === 'PATCH') {
      writes++
      await gate
      displayName = route.request().postDataJSON().displayName
    }
    await route.fulfill({
      json: {
        ...user,
        displayName,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      },
    })
  })
  try {
    await page.goto('/account')
    await page.getByLabel('Display name', { exact: true }).fill('After save')
    const save = page.getByRole('button', {
      name: 'Save display name',
      exact: true,
    })
    const before = await save.boundingBox()
    await save.dblclick()
    const pending = page.getByRole('button', {
      name: 'Saving display name…',
      exact: true,
    })
    await expect(pending).toBeDisabled()
    await expect(pending).toHaveAttribute('aria-busy', 'true')
    const after = await pending.boundingBox()
    expect(Math.abs(before.width - after.width)).toBeLessThanOrEqual(1)
    expect(writes).toBe(1)
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'After save',
    )
    await expect(
      page.getByRole('progressbar', { name: 'Loading page', exact: true }),
    ).toHaveCount(0)
    release()
    await expect(save).toBeEnabled()
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('refreshing order history keeps the previous list visible until the new read finishes', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/orders?**', async (route) => {
    reads++
    if (reads > 1) await gate
    await route.fulfill({
      json: { items: [], total: 0, page: 1, limit: 20, pages: 1 },
    })
  })
  try {
    await page.goto('/account/orders')
    await expect(
      page.getByText('No orders on this account.', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Refresh orders', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Refreshing orders…', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByText('No orders on this account.', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Loading your orders', exact: true }),
    ).toHaveCount(0)
    release()
    await expect(
      page.getByRole('button', { name: 'Refresh orders', exact: true }),
    ).toBeEnabled()
    expect(reads).toBe(2)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('invalid order input exits pending state and leaves recovery available', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  await page.goto('/account/orders/invalid-order')
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'Enter a canonical order UUID.',
  )
  await expect(
    page.getByRole('button', { name: 'Refresh order', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('status', {
      name: 'Loading order and ledgers',
      exact: true,
    }),
  ).toHaveCount(0)
})

test('explicit product refresh bypasses cached data and failed reads stay retryable', async ({
  page,
}) => {
  await mock(page)
  let reads = 0
  await page.route('**/v1/products?**', (route) => {
    reads++
    if (reads === 2)
      return route.fulfill({
        status: 503,
        json: { message: 'Temporarily unavailable' },
      })
    return route.fulfill({
      json: {
        items: [
          {
            ...products[0],
            title: reads === 1 ? 'Before refresh' : 'After refresh',
          },
        ],
        total: 1,
        page: 1,
        limit: 12,
        pages: 1,
      },
    })
  })
  await openControlled(page, '/shop')
  await expect(
    page.getByRole('link', { name: 'Before refresh', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Refresh products', exact: true })
    .click()
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'After refresh', exact: true }),
  ).toBeVisible()
  expect(reads).toBe(3)
})

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = {
  id: id(99),
  email: 'design@example.test',
  role: 'CUSTOMER',
  staffRole: null,
  permissions: [],
}
const image = {
  id: id(80),
  url: 'https://media.example.test/product.svg',
  alt: 'Test product image',
  position: 0,
  width: 640,
  height: 640,
}
const categories = [
  {
    id: id(1),
    name: 'Electronics',
    slug: 'electronics',
    description: 'Tech for everyday life',
    color: '#EAF0FF',
    parentId: null,
    active: true,
    sortOrder: 0,
  },
  {
    id: id(2),
    name: 'Audio',
    slug: 'audio',
    description: '',
    color: '#EAF0FF',
    parentId: id(1),
    active: true,
    sortOrder: 0,
  },
]
const products = Array.from({ length: 10 }, (_, index) => ({
  id: id(index + 10),
  title: 'API product ' + (index + 1),
  slug: 'live-product-' + (index + 1),
  description: 'A real API-shaped product',
  sku: 'SKU-' + index,
  status: 'ACTIVE',
  currency: 'USD',
  priceMinor: 1999,
  compareAtMinor: 2999,
  hasVariants: false,
  variants: [],
  categoryIds: [id(1)],
  gallery: [image],
  purchasable: true,
  stockOnHand: 10,
  badge: 'New',
  tag: 'new',
}))
const collectionProducts = products.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  currency: p.currency,
  priceMinor: p.priceMinor,
  compareAtMinor: p.compareAtMinor,
  badge: p.badge,
  tag: p.tag,
  hasVariants: p.hasVariants,
  image,
  availableQuantity: 10,
}))
const collection = {
  id: id(70),
  slug: 'new-arrivals',
  title: 'New Arrivals',
  description: '',
  position: 0,
  productIds: products.map((p) => p.id),
  productCount: 10,
  productsTruncated: false,
  products: collectionProducts,
}
const homepage = {
  schemaVersion: 1,
  revision: '1',
  bannersTruncated: false,
  collectionsTruncated: false,
  banners: ['hero', 'secondary', 'promo'].map((slot, index) => ({
    id: id(60 + index),
    headline: ['Discover something new', 'Everyday tech', 'Everyday favorites'][
      index
    ],
    subtitle: 'Thoughtfully picked for you',
    ctaText: 'Shop now',
    ctaHref: '/shop',
    slot,
    position: index,
    image,
  })),
  collections: [
    {
      ...collection,
      productsTruncated: true,
      products: collectionProducts.slice(0, 8),
    },
  ],
}
const emptyCart = {
  cartId: null,
  currency: null,
  items: [],
  subtotalMinor: 0,
  amountDueMinor: null,
  checkoutReady: false,
  issues: [],
  quotedAt: new Date().toISOString(),
}
const cart = {
  ...emptyCart,
  cartId: id(50),
  currency: 'USD',
  checkoutReady: true,
  subtotalMinor: 1999,
  items: [
    {
      id: id(51),
      image,
      productId: products[0].id,
      variantId: null,
      title: products[0].title,
      sku: products[0].sku,
      quantity: 1,
      availableQuantity: 10,
      unitPriceMinor: 1999,
      lineTotalMinor: 1999,
      currency: 'USD',
      status: 'AVAILABLE',
    },
  ],
}

test('public products render in Home, Shop and collection HTML with JavaScript disabled', async ({
  browser,
  request,
}) => {
  const response = await request.get(
    process.env.ESHOP_API_URL + '/v1/store/homepage',
  )
  expect(response.ok()).toBe(true)
  const home = await response.json()
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await expect(
      page.locator('#collection-panel article').first(),
    ).toBeVisible()
    await expect(
      page
        .locator('section')
        .filter({
          has: page.getByRole('heading', {
            name: 'Shop by category',
            exact: true,
          }),
        })
        .locator('a[href^="/shop?category="]')
        .first(),
    ).toBeVisible()
    await page.goto('/shop')
    await expect(page.locator('main article').first()).toBeVisible()
    if (home.collections[0]) {
      await page.goto('/collections/' + home.collections[0].slug)
      await expect(page.locator('main article').first()).toBeVisible()
    }
  } finally {
    await context.close()
  }
})

test('server-rendered Shop does not duplicate its initial product-list request in the browser', async ({
  page,
}) => {
  await mock(page)
  let reads = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/v1/products') reads++
  })
  await page.goto('/shop')
  await expect(page.locator('main article').first()).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add to cart', exact: true }).first(),
  ).toBeEnabled()
  expect(reads).toBe(0)
})

test('server-rendered category cards stay visible while a stale browser read is delayed', async ({
  page,
}) => {
  await page.clock.setFixedTime(Date.now() + 60000)
  await mock(page)
  let release,
    reads = 0
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/categories', async (route) => {
    reads++
    await gate
    await route.fulfill({ json: categories }).catch(() => {})
  })
  try {
    await openControlled(page, '/')
    await expect.poll(() => reads).toBe(1)
    const section = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', {
          name: 'Shop by category',
          exact: true,
        }),
      })
    expect(await section.getByRole('link').count()).toBeGreaterThan(2)
    await expect(
      section.getByRole('status', { name: 'Loading categories', exact: true }),
    ).toHaveCount(0)
    release()
    await expect(
      section.getByRole('link', { name: 'Electronics', exact: true }),
    ).toBeVisible()
    await expect(section.locator('a[href^="/shop?category="]')).toHaveCount(1)
    expect(reads).toBe(1)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('fresh server category data seeds hydration without a duplicate browser category read', async ({
  page,
}) => {
  await mock(page)
  let reads = 0
  let configurationReads = 0
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path === '/v1/categories') reads++
    if (['/v1/store/bootstrap', '/v1/store/operations'].includes(path))
      configurationReads++
  })
  await page.goto('/shop?q=category-seed-probe')
  await page
    .getByRole('button', { name: 'Refresh products', exact: true })
    .click()
  await expect(page.locator('main article')).toHaveCount(10)
  await page
    .locator('header')
    .getByRole('button', { name: 'Categories', exact: true })
    .click()
  expect(
    await page.locator('header a[href^="/shop?category="]').count(),
  ).toBeGreaterThan(0)
  expect(reads).toBe(0)
  expect(configurationReads).toBe(0)
})

test('failed category refresh retains the rendered cards and retries through the existing control', async ({
  page,
}) => {
  await page.clock.setFixedTime(Date.now() + 60000)
  await mock(page)
  let fail = true
  await page.route('**/v1/categories', (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { message: 'Category refresh unavailable.' } }
        : { json: categories },
    ),
  )
  await openControlled(page, '/')
  const section = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Shop by category', exact: true }),
    })
  await expect(
    section.getByText('Categories are temporarily unavailable.', {
      exact: true,
    }),
  ).toBeVisible()
  expect(await section.getByRole('link').count()).toBeGreaterThan(2)
  await expect(
    section.getByRole('status', { name: 'Loading categories', exact: true }),
  ).toHaveCount(0)
  fail = false
  await section
    .getByRole('button', { name: 'Retry loading categories', exact: true })
    .click()
  await expect(
    section.getByText('Categories are temporarily unavailable.', {
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    section.getByRole('link', { name: 'Electronics', exact: true }),
  ).toBeVisible()
  await expect(section.locator('a[href^="/shop?category="]')).toHaveCount(1)
})

test('homepage keeps the hero stable after a failed refresh and avoids redundant complete-collection reads', async ({
  page,
}) => {
  await mock(page)
  let fail = false
  let collectionReads = 0
  const complete = {
    ...homepage,
    collections: [
      {
        ...collection,
        products: products.slice(0, 8),
        productsTruncated: true,
        productCount: 10,
      },
    ],
  }
  await page.route('**/v1/store/homepage', (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { message: 'Unavailable' } }
        : { json: complete },
    ),
  )
  await page.route('**/v1/store/collections/new-arrivals', (route) => {
    collectionReads++
    return route.fulfill({ json: collection })
  })
  await openControlled(page, '/')
  await expect(page.locator('#collection-panel article')).toHaveCount(8)
  const hero = page.locator('main article').first()
  await expect(hero.locator('img')).toHaveCount(1)
  await expect(hero.locator('img')).toHaveAttribute('fetchpriority', 'high')
  const top = await hero.evaluate(
    (element) => element.getBoundingClientRect().top + scrollY,
  )
  fail = true
  await page
    .getByRole('button', { name: 'Refresh featured content', exact: true })
    .click()
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Published store content is unavailable.',
  )
  expect(
    await hero.evaluate(
      (element) => element.getBoundingClientRect().top + scrollY,
    ),
  ).toBe(top)
  expect(collectionReads).toBe(0)
  fail = false
  await page
    .getByRole('button', { name: 'Retry loading content', exact: true })
    .click()
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
  const sizes = await page
    .locator('#collection-panel img')
    .first()
    .getAttribute('sizes')
  expect(
    await page.evaluate(
      (value) =>
        value
          .split(/,\s*(?=\(min-width|calc)/)
          .every((part) =>
            CSS.supports('width', part.slice(part.indexOf('calc('))),
          ),
      sizes,
    ),
  ).toBe(true)
})

test('background store-configuration failures retain the current brand', async ({
  page,
}) => {
  const clockStart = Date.now()
  await page.clock.setFixedTime(clockStart + 60000)
  await mock(page)
  let reads = 0
  let fail = false
  await page.route('**/v1/store/bootstrap', (route) => {
    reads++
    return route.fulfill(
      fail
        ? { status: 503, json: { message: 'Unavailable' } }
        : {
            json: {
              profile: {
                configured: true,
                storeName: 'Fixture Store',
                supportEmail: null,
                supportNotice: '',
                websiteUrl: '',
              },
              content: {
                seoTitle: '',
                seoDescription: '',
                footerText: '',
                privacyPolicy: '',
                termsOfService: '',
                returnPolicy: '',
              },
              branding: { logo: null, favicon: null },
            },
          },
    )
  })
  await page.route('**/v1/store/operations', route => route.fulfill(fail ? { status: 503, json: { message: 'Unavailable' } } : { json: {
    configured: true, locale: 'en-US', displayCurrency: 'EUR', themeMode: 'light', accentColor: '#2459e8', showWishlist: true, showPolicies: true,
  } }))
  await page.goto('/shop')
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Fixture Store home', exact: true })
  await expect(logo).toBeVisible()
  await expect(page.getByLabel('Preferred display currency; prices retain their listed currency')).toHaveText('EUR')
  fail = true
  await page.clock.setFixedTime(clockStart + 120000)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => reads).toBe(2)
  await expect(logo).toBeVisible()
  await expect(page.getByLabel('Preferred display currency; prices retain their listed currency')).toHaveText('EUR')
})

async function mock(
  page,
  {
    authenticated = false,
    configured = false,
    singleBanner = false,
    initialCart = null,
  } = {},
) {
  if (initialCart) await seedLocalCart(page, authenticated, initialCart)
  await page.route('https://media.example.test/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#dbeafe"/><circle cx="320" cy="320" r="150" fill="#779adf"/></svg>',
    }),
  )
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated
        ? {
            accessToken: 'controlled-design-test-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            user,
          }
        : { authenticated: false },
    }),
  )
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    // Every browser write is mocked; no production write is sent by this suite.
    if (route.request().method() !== 'GET')
      return route.fulfill({
        status: 409,
        json: { message: 'Controlled write blocked by design test' },
      })
    let data
    if (path === '/v1/store/operations')
      data = {
        configured,
        locale: 'en-US',
        displayCurrency: 'USD',
        themeMode: 'light',
        accentColor: configured ? '#137B5A' : '#1F2937',
        showWishlist: true,
        showPolicies: true,
      }
    else if (path === '/v1/store/bootstrap')
      data = {
        profile: {
          configured: false,
          storeName: null,
          supportEmail: null,
          supportNotice: '',
        },
        content: { footerText: '', seoTitle: '', seoDescription: '' },
        branding: { logo: null, favicon: null },
      }
    else if (path === '/v1/store/homepage')
      data = {
        ...homepage,
        banners: singleBanner ? homepage.banners.slice(0, 1) : homepage.banners,
      }
    else if (path === '/v1/store/collections/new-arrivals') data = collection
    else if (path === '/v1/categories') data = categories
    else if (path === '/v1/products')
      data = {
        items: products,
        total: products.length,
        page: 1,
        limit: 12,
        pages: 1,
      }
    else if (path.startsWith('/v1/products/'))
      data = products.find((p) => p.slug === path.split('/').at(-1))
    else if (path === '/v1/auth/me') data = user
    else if (path === '/v1/wishlist')
      data = {
        items: [
          {
            productId: products[0].id,
            slug: products[0].slug,
            title: products[0].title,
            currency: 'USD',
            priceMinor: 1999,
            addedAt: new Date().toISOString(),
          },
        ],
        count: 1,
      }
    else if (path === '/v1/account/profile')
      data = {
        ...user,
        displayName: 'Design customer',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      }
    else if (path === '/v1/account/addresses') data = { items: [] }
    else if (path === '/v1/checkout/recovery')
      data = { reservation: null, orderId: null }
    else if (path.includes('unread')) data = { count: 0 }
    else
      return route.fulfill({
        status: 404,
        json: { message: 'Not available in design fixture' },
      })
    return route.fulfill({
      status: data ? 200 : 404,
      json: data || { message: 'Not found' },
    })
  })
}

for (const width of [390, 768, 1440]) {
  test(`homepage preserves palette, bounded cards and no horizontal overflow at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await mock(page)
    await openControlled(page, '/')
    await expect(
      page.getByRole('heading', {
        name: 'Discover something new',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('#collection-panel article')).toHaveCount(8)
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--primary')
            .trim(),
        ),
      )
      .toBe('#2459e8')
    await expect(page.locator('footer')).toHaveCSS(
      'background-color',
      'rgb(20, 32, 58)',
    )
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await page.screenshot({
      path: info.outputPath(`home-${width}.png`),
      fullPage: true,
    })
  })
}

test('explicit branding overrides both primary and hover; one banner spans the hero row', async ({
  page,
}) => {
  await page.clock.setFixedTime(Date.now() + 60000)
  await mock(page, { configured: true, singleBanner: true })
  await openControlled(page, '/')
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--primary'),
      ),
    )
    .toBe('#137B5A')
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--primary-hover'),
      ),
    )
    .toContain('#137B5A')
  const hero = page.locator('main article').first()
  await expect
    .poll(async () => (await hero.boundingBox())?.width)
    .toBeGreaterThan(1100)
})

test('mobile shop has two product columns, keyboard filters, and a server filter query', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mock(page)
  await openControlledCategories(page, '/shop')
  await expect(page.locator('main article')).toHaveCount(10)
  await expect(page.locator('#shop-filters')).toHaveCount(1)
  await expect(page.locator('#shop-filters')).toBeHidden()
  const first = await page.locator('main article').nth(0).boundingBox()
  const second = await page.locator('main article').nth(1).boundingBox()
  expect(first.y).toBe(second.y)
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Close filters' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Filters', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByLabel('Category', { exact: true }).selectOption('audio')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page).toHaveURL(/category=audio/)
  await expect(page.locator('#shop-filters')).toHaveCount(1)
  await expect(page.locator('#shop-filters')).toBeHidden()
  await page.screenshot({
    path: info.outputPath('shop-mobile.png'),
    fullPage: true,
  })
})

test('category hierarchy uses root feature tiles and child links', async ({
  page,
}) => {
  await mock(page)
  await openControlledCategories(page, '/categories')
  await expect(
    page.locator('main').getByRole('link', { name: /Electronics Tech/ }),
  ).toBeVisible()
  await expect(
    page.locator('main').getByRole('link', { name: 'Audio', exact: true }),
  ).toHaveAttribute('href', '/shop?category=audio')
  await page
    .locator('header')
    .getByRole('button', { name: 'Categories', exact: true })
    .click()
  await expect(
    page.locator('header').getByRole('link', { name: 'Audio', exact: true }),
  ).toHaveCount(0)
})

for (const path of ['/account', '/checkout', '/wishlist', '/cart']) {
  test(`authenticated ${path} preserves its API data inside the restored layout`, async ({
    page,
  }, info) => {
    await mock(page, { authenticated: true, initialCart: cart })
    await page.goto(path)
    if (path === '/account') {
      await expect(
        page.getByRole('navigation', { name: 'Account navigation' }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Saved addresses', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Security settings', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByLabel('Display name', { exact: true }),
      ).toHaveValue('Design customer')
      await expect(page.getByText('Demo orders', { exact: true })).toHaveCount(
        0,
      )
    } else if (path === '/checkout') {
      await expect(
        page.getByRole('list', { name: 'Checkout progress' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Order summary' }),
      ).toBeVisible()
      await expect(
        page.getByLabel('Delivery address', { exact: true }),
      ).toBeVisible()
    } else if (path === '/wishlist') {
      await expect(
        page
          .locator('main article')
          .getByRole('img', { name: 'Test product image' }),
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole('heading', { name: 'Order summary' }),
      ).toBeVisible()
      await expect(
        page.locator('main').getByRole('img', { name: products[0].title }),
      ).toBeVisible()
      await expect(
        page.getByText('$19.99', { exact: true }).first(),
      ).toBeVisible()
    }
    await page.screenshot({
      path: info.outputPath(path.slice(1) + '-desktop.png'),
      fullPage: true,
    })
  })
}

for (const width of [390, 1440]) {
  test(`order tracking retains account navigation at ${width}px after navigation and direct reload`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await mock(page, { authenticated: true })
    await page.goto('/account')
    const navigation = page.getByRole('navigation', {
      name: 'Account navigation',
    })
    await navigation
      .getByRole('link', { name: 'Track your order', exact: true })
      .click()
    await expect(page).toHaveURL(/\/track$/)
    await expect(navigation).toBeVisible()
    await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      '/track',
    )
    await expect(page.getByLabel('Order UUID', { exact: true })).toBeVisible()
    await page.reload()
    await expect(navigation).toBeVisible()
    await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      '/track',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await navigation
      .getByRole('link', { name: 'Saved addresses', exact: true })
      .click()
    await expect(page).toHaveURL(/\/account\/addresses$/)
    await expect(navigation).toBeVisible()
  })
}

test('production product rendering returns 200 and missing products return 404', async ({
  request,
}) => {
  // Server-side public reads intentionally exercise the trusted real Backend.
  const response = await request.get('/product/non-slip-yoga-mat')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('Non-Slip Yoga Mat')
  const absent = await request.get('/product/design-audit-nonexistent-8cd589')
  expect(absent.status()).toBe(404)
})

for (const width of [390, 1440]) {
  test(`real public content and media render without overflow at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 401,
        json: { message: 'No session in read-only storefront test' },
      }),
    )
    await page.route('**/v1/**', (route) =>
      route.request().method() === 'GET'
        ? page.request
            .get(route.request().url())
            .then((response) => route.fulfill({ response }))
        : route.fulfill({
            status: 409,
            json: { message: 'Production writes blocked by test' },
          }),
    )
    await page.goto('/')
    const hero = page.locator('main article').first()
    await expect(hero).toBeVisible()
    await expect
      .poll(() =>
        hero
          .locator('img:visible')
          .first()
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true)
    await expect
      .poll(() => page.locator('#collection-panel article').count())
      .toBeGreaterThan(0)
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await expect(
      page.getByText('Loading the complete collection…', { exact: true }),
    ).toHaveCount(0)
    // Exercise native lazy loading as a customer scrolls before the full-page receipt.
    for (const card of await page.locator('#collection-panel article').all()) {
      await card.scrollIntoViewIfNeeded()
      await expect
        .poll(async () =>
          card
            .locator('img')
            .evaluateAll((imgs) =>
              imgs.every((img) => img.complete && img.naturalWidth > 0),
            ),
        )
        .toBe(true)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: info.outputPath(`real-home-${width}.png`),
      fullPage: true,
    })
    await page.unrouteAll({ behavior: 'wait' })
  })
}

for (const register of [false, true]) {
  test(`${register ? 'registration' : 'sign-in'} uses the storefront design and the real session contract`, async ({
    page,
  }, info) => {
    await mock(page)
    await page.route('**/api/auth/session', (route) => {
      const { action } = route.request().postDataJSON()
      return route.fulfill({
        status: action === 'refresh' ? 401 : 200,
        json:
          action === 'login' || action === 'register'
            ? {
                accessToken: 'controlled-storefront-session-token',
                tokenType: 'Bearer',
                expiresIn: 900,
                user,
              }
            : { message: 'No session' },
      })
    })
    await page.goto(register ? '/sign-up' : '/sign-in')
    await expect(
      page.getByRole('complementary', { name: 'Account benefits' }),
    ).toBeVisible()
    await page.getByLabel('Email', { exact: true }).fill('design@example.test')
    await page
      .getByLabel('Password', { exact: true })
      .fill('Controlled-Example-2026!')
    if (register)
      await page
        .getByLabel('Confirm password', { exact: true })
        .fill('Controlled-Example-2026!')
    await page.screenshot({
      path: info.outputPath(register ? 'sign-up.png' : 'sign-in.png'),
      fullPage: true,
    })
    const write = page.waitForRequest(
      (r) =>
        r.url().endsWith('/api/auth/session') &&
        r.postDataJSON()?.action === (register ? 'register' : 'login'),
    )
    await page
      .getByRole('button', {
        name: register ? 'Create account' : 'Sign in',
        exact: true,
      })
      .click()
    expect((await write).postDataJSON()).toEqual({
      action: register ? 'register' : 'login',
      email: 'design@example.test',
      password: 'Controlled-Example-2026!',
    })
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'Design customer',
    )
    expect(
      await page.evaluate(() =>
        [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
          (value) => value.includes('Controlled-Example-2026!'),
        ),
      ),
    ).toBe(false)
  })
}

test('anonymous private navigation requires sign-in', async ({ page }) => {
  await mock(page)
  await page.goto('/account/orders')
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.getByLabel('Password', { exact: true })).toBeEnabled()
})

test('catalog refresh failure keeps existing API products visible and offers retry', async ({
  page,
}) => {
  await mock(page)
  await openControlled(page, '/shop')
  await expect(page.locator('main article')).toHaveCount(10)
  await page.route('**/v1/products?**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await page
    .getByRole('button', { name: 'Refresh products', exact: true })
    .click()
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Retry loading', exact: true }),
  ).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(10)
})

function confirmedCart(quantity) {
  return {
    ...cart,
    items: [
      {
        ...cart.items[0],
        quantity,
        lineTotalMinor: products[0].priceMinor * quantity,
      },
    ],
    subtotalMinor: products[0].priceMinor * quantity,
  }
}

async function seedLocalCart(page, authenticated, quote) {
  await page.addInitScript(
    ({ key, quote }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            cart: {
              ...quote,
              stockChecked: false,
              items: quote.items.map((item) => ({
                ...item,
                availableQuantity: null,
              })),
            },
          }),
        )
    },
    { key: 'eshop-cart-v1:' + (authenticated ? user.id : 'guest'), quote },
  )
}
const wishlistPayload = (...selected) => ({
  items: selected.map((product) => ({
    productId: product.id,
    slug: product.slug,
    title: product.title,
    currency: product.currency,
    priceMinor: product.priceMinor,
    addedAt: new Date().toISOString(),
  })),
  count: selected.length,
})

test('wishlist heart and count update before a delayed PUT and rapid toggles retain the latest choice', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0,
    writes = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/wishlist', (route) => {
    reads++
    return route.fulfill({ json: wishlistPayload() })
  })
  await page.route('**/v1/wishlist/' + products[0].id, async (route) => {
    writes++
    await gate
    await route.fulfill({ json: wishlistPayload(products[0]) })
  })
  try {
    await openControlled(page, '/shop')
    const save = () =>
      page.getByRole('button', {
        name: 'Save item: ' + products[0].title,
        exact: true,
      })
    const remove = () =>
      page.getByRole('button', {
        name: 'Remove saved item: ' + products[0].title,
        exact: true,
      })
    await save().click()
    await expect(remove()).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page
        .locator('header')
        .getByRole('link', { name: 'Wishlist', exact: true }),
    ).toContainText('1')
    await remove().click()
    await expect(save()).toHaveAttribute('aria-pressed', 'false')
    await save().click()
    await expect(remove()).toHaveAttribute('aria-pressed', 'true')
    expect(writes).toBe(1)
    const response = page.waitForResponse((value) =>
      value.url().endsWith('/v1/wishlist/' + products[0].id),
    )
    release()
    await response
    await page
      .locator('header')
      .getByRole('link', { name: 'Wishlist', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Saved items', exact: true }),
    ).toBeVisible()
    expect(reads).toBe(1)
    expect(writes).toBe(1)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('wishlist rejection rolls back the heart and allows another click without refreshing the page', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let writes = 0,
    reads = 0
  await page.route('**/v1/wishlist', (route) => {
    reads++
    return route.fulfill({ json: wishlistPayload() })
  })
  await page.route('**/v1/wishlist/' + products[0].id, (route) => {
    writes++
    return route.fulfill(
      writes === 1
        ? { status: 409, json: { message: 'Wishlist limit reached' } }
        : { json: wishlistPayload(products[0]) },
    )
  })
  await openControlled(page, '/shop')
  const save = page.getByRole('button', {
    name: 'Save item: ' + products[0].title,
    exact: true,
  })
  await save.click()
  await expect(
    page.getByText('Wishlist limit reached', { exact: true }).first(),
  ).toBeVisible()
  await expect(save).toBeEnabled()
  await expect(save).toHaveAttribute('aria-pressed', 'false')
  await save.click()
  await expect(
    page.getByRole('button', {
      name: 'Remove saved item: ' + products[0].title,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText('Wishlist limit reached', { exact: true }),
  ).toHaveCount(0)
  expect(writes).toBe(2)
  expect(reads).toBe(1)
})

test('wishlist removal updates the saved-items page before the server responds', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/wishlist', (route) => {
    reads++
    return route.fulfill({ json: wishlistPayload(products[0]) })
  })
  await page.route('**/v1/wishlist/' + products[0].id, async (route) => {
    await gate
    await route.fulfill({ json: { removed: true } })
  })
  try {
    await page.goto('/wishlist')
    await page
      .getByRole('button', { name: /Remove saved item/ })
      .first()
      .click()
    await expect(
      page.getByText(
        'No saved products yet. Save products from their detail pages.',
        { exact: true },
      ),
    ).toBeVisible()
    expect(reads).toBe(1)
    const response = page.waitForResponse((value) =>
      value.url().endsWith('/v1/wishlist/' + products[0].id),
    )
    release()
    await response
    await expect(
      page.getByText(
        'No saved products yet. Save products from their detail pages.',
        { exact: true },
      ),
    ).toBeVisible()
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('a delayed initial wishlist read cannot erase an already saved heart', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/wishlist', async (route) => {
    reads++
    await gate
    await route.fulfill({ json: wishlistPayload() })
  })
  await page.route('**/v1/wishlist/' + products[0].id, (route) =>
    route.fulfill({ json: wishlistPayload(products[0]) }),
  )
  try {
    await openControlled(page, '/shop')
    await page
      .getByRole('button', {
        name: 'Save item: ' + products[0].title,
        exact: true,
      })
      .click()
    const heart = page.getByRole('button', {
      name: 'Remove saved item: ' + products[0].title,
      exact: true,
    })
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    const response = page.waitForResponse((value) =>
      value.url().endsWith('/v1/wishlist'),
    )
    release()
    await response
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    expect(reads).toBe(1)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('account switching fences a delayed wishlist write from the previous owner', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let current = user,
    reads = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        accessToken: 'controlled-wishlist-session-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: current,
      },
    }),
  )
  await page.route('**/v1/auth/me', (route) => route.fulfill({ json: current }))
  await page.route('**/v1/account/profile', (route) =>
    route.fulfill({
      json: {
        ...current,
        displayName: 'Current owner',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      },
    }),
  )
  await page.route('**/v1/wishlist', (route) => {
    reads++
    return route.fulfill({
      json:
        current.id === user.id
          ? wishlistPayload()
          : wishlistPayload(products[2]),
    })
  })
  await page.route('**/v1/wishlist/' + products[0].id, async (route) => {
    await gate
    await route.fulfill({ json: wishlistPayload(products[0]) }).catch(() => {})
  })
  try {
    await openControlled(page, '/shop')
    await page
      .getByRole('button', {
        name: 'Save item: ' + products[0].title,
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('button', {
        name: 'Remove saved item: ' + products[0].title,
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    current = { ...user, id: id(97), email: 'wishlist-owner-b@example.test' }
    await page.evaluate(() => {
      const channel = new BroadcastChannel('eshop-auth-customer')
      channel.postMessage({ type: 'login', source: 'other-wishlist-tab' })
      channel.close()
    })
    const ownerBHeart = page.getByRole('button', {
      name: 'Remove saved item: ' + products[2].title,
      exact: true,
    })
    await expect(ownerBHeart).toHaveAttribute('aria-pressed', 'true')
    release()
    await expect(
      page.getByRole('button', {
        name: 'Save item: ' + products[0].title,
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(ownerBHeart).toHaveAttribute('aria-pressed', 'true')
    expect(reads).toBeGreaterThanOrEqual(2)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

async function checkoutScenario(page, initialQuantity = 12) {
  await mock(page, {
    authenticated: true,
    initialCart: confirmedCart(initialQuantity),
  })
  const quantity = () =>
    page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key))?.cart.items[0]?.quantity || 0,
      'eshop-cart-v1:' + user.id,
    )
  await page.route('**/v1/account/addresses', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: id(70),
            label: 'Home',
            recipientName: 'Customer',
            phone: '+12025550123',
            addressLine1: '1 Checkout Street',
            addressLine2: '',
            city: 'Example',
            region: '',
            postalCode: '',
            countryCode: 'US',
            isDefault: true,
          },
        ],
      },
    }),
  )
  await page.route('**/v1/checkout/delivery-options', (route) => {
    const items = route.request().postDataJSON().items
    const subtotalMinor = items.reduce(
      (sum, item) => sum + item.quantity * products[0].priceMinor,
      0,
    )
    return route.fulfill({
      json: {
        countryCode: 'US',
        currency: 'USD',
        subtotalMinor,
        discountMinor: 0,
        options: [
          {
            kind: null,
            label: 'Standard',
            shippingMinor: 0,
            taxMinor: 0,
            totalMinor: subtotalMinor,
            etaNote: '3 days',
          },
        ],
      },
    })
  })
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<main>Stripe Checkout opened</main>',
    }),
  )
  return {
    quantity,
    shortage: (available) => ({
      code: 'INSUFFICIENT_STOCK',
      message: 'Stock changed',
      items: [
        {
          itemId: cart.items[0].id,
          productId: products[0].id,
          variantId: null,
          title: products[0].title,
          sku: products[0].sku,
          requestedQuantity: initialQuantity,
          availableQuantity: available,
        },
      ],
    }),
    session: () => ({
      orderId: id(80),
      sessionId: 'cs_test_Checkout12345678',
      url: 'https://checkout.stripe.com/c/pay/test_checkout',
      expiresAt: new Date(Date.now() + 31 * 60000).toISOString(),
    }),
  }
}

test('session preload reuses addresses and profile across account and checkout navigation', async ({
  page,
}) => {
  await checkoutScenario(page, 2)
  let addresses = 0,
    profiles = 0,
    preferences = 0
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path === '/v1/account/addresses') addresses++
    if (path === '/v1/account/profile') profiles++
    if (path === '/v1/notifications/preferences') preferences++
  })
  await page.goto('/shop')
  await expect.poll(() => addresses).toBe(1)
  await expect.poll(() => profiles).toBe(1)
  await expect.poll(() => preferences).toBe(1)
  await page
    .locator('header')
    .getByRole('link', { name: 'Account', exact: true })
    .click()
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
    'Design customer',
  )
  await page.getByRole('link', { name: 'Saved addresses', exact: true }).click()
  await expect(
    page.getByText('1 Checkout Street', { exact: false }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open cart', exact: false }).click()
  await page
    .getByRole('link', { name: 'Continue to checkout', exact: true })
    .click()
  await expect(page.getByLabel('Delivery address')).toHaveValue(id(70))
  await expect(
    page.getByText('Loading checkout…', { exact: true }),
  ).toHaveCount(0)
  expect(addresses).toBe(1)
  expect(profiles).toBe(1)
  const persisted = await page.evaluate(() =>
    Object.keys(localStorage)
      .map((key) => localStorage.getItem(key))
      .join(' '),
  )
  expect(persisted).not.toContain('1 Checkout Street')
  expect(persisted).not.toContain('Design customer')
})

test('background profile refresh preserves an unsaved display-name edit', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  await page.addInitScript(() => {
    const currentTime = Date.now
    window.cacheTimeOffset = 0
    Date.now = () => currentTime() + window.cacheTimeOffset
  })
  let reads = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/account/profile', async (route) => {
    reads++
    const refreshing = reads > 1
    if (refreshing) await gate
    await route.fulfill({
      json: {
        ...user,
        displayName: refreshing ? 'Changed elsewhere' : 'Cached profile',
        emailVerified: !refreshing,
        createdAt: new Date().toISOString(),
      },
    })
  })
  try {
    await page.goto('/account')
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'Cached profile',
    )
    await page
      .getByRole('link', { name: 'Continue shopping', exact: true })
      .click()
    await expect.poll(() => reads).toBe(1)
    await page.evaluate(() => {
      window.cacheTimeOffset = 300001
    })
    await page
      .locator('header')
      .getByRole('link', { name: 'Account', exact: true })
      .click()
    const field = page.getByLabel('Display name', { exact: true })
    await expect(field).toHaveValue('Cached profile')
    await field.fill('My unsaved edit')
    release()
    await expect(
      page.getByText('Email not yet verified', { exact: false }),
    ).toBeVisible()
    await expect(field).toHaveValue('My unsaved edit')
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

async function notificationScenario(page) {
  await mock(page, { authenticated: true })
  let deviceReads = 0
  let rows = [
    {
      id: id(71),
      title: 'Order placed',
      body: 'Your order ' + id(80) + ' has been placed.',
      readAt: null,
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: id(72),
      title: 'Delivery update',
      body: 'Your package is on its way.',
      readAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]
  await page.route('**/v1/notifications/preferences', (route) =>
    route.fulfill({
      json: {
        revision: 0,
        securityEmailRequired: true,
        transactionalInAppRequired: true,
        transactionalEmail: true,
        transactionalPush: true,
        operationalInApp: false,
        operationalEmail: false,
        operationalPush: false,
        marketingInApp: false,
        marketingEmail: false,
        marketingPush: false,
      },
    }),
  )
  await page.route('**/v1/notifications/push/devices', (route) => {
    deviceReads++
    return route.fulfill({ json: [] })
  })
  await page.route('**/v1/notifications?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    const items =
      query.get('readState') === 'unread'
        ? rows.filter((row) => !row.readAt)
        : rows
    return route.fulfill({
      json: {
        items,
        total: items.length,
        unread: rows.filter((row) => !row.readAt).length,
        page: 1,
        pages: items.length ? 1 : 0,
      },
    })
  })
  await page.route('**/v1/notifications/*/read', (route) => {
    const rowId = new URL(route.request().url()).pathname.split('/').at(-2)
    rows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            readAt: route.request().postDataJSON().read
              ? new Date().toISOString()
              : null,
          }
        : row,
    )
    return route.fulfill({ json: {} })
  })
  await page.route('**/v1/notifications/read-all', (route) => {
    rows = rows.map((row) => ({ ...row, readAt: new Date().toISOString() }))
    return route.fulfill({ json: { changed: rows.length } })
  })
  return { deviceReads: () => deviceReads }
}

for (const width of [390, 1440]) {
  test(`inbox uses compact rows and a separate notification settings page at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    const scenario = await notificationScenario(page)
    await page.goto('/account/notifications')
    const inbox = page.getByRole('region', {
      name: 'Notification inbox',
      exact: true,
    })
    await expect(inbox.locator('article')).toHaveCount(2)
    await expect(inbox).toContainText('1 unread')
    await expect(
      inbox.getByRole('navigation', { name: 'Message pages' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', {
        name: 'Save notification preferences',
        exact: true,
      }),
    ).toHaveCount(0)
    expect(scenario.deviceReads()).toBe(0)
    await expect(
      inbox.getByText('Your order #00000000 has been placed.', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: info.outputPath('inbox.png'),
      fullPage: true,
    })
    await page
      .getByRole('link', { name: 'Notification settings', exact: true })
      .click()
    await expect(page).toHaveURL(/\/account\/notification-settings$/)
    await expect(page.getByRole('switch')).toHaveCount(8)
    await expect(
      page.getByRole('region', { name: 'Browser notifications', exact: true }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('navigation', { name: 'Account navigation' })
        .locator('a[aria-current="page"]'),
    ).toHaveAttribute('href', '/account/notifications')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: info.outputPath('notification-settings.png'),
      fullPage: true,
    })
    await page.getByRole('link', { name: 'Back to inbox', exact: true }).click()
    await inbox.getByRole('button', { name: 'Unread', exact: true }).click()
    await expect(inbox.locator('article')).toHaveCount(1)
    await inbox
      .getByLabel('Message options for Order placed', { exact: true })
      .click()
    await inbox.getByRole('button', { name: 'Mark read', exact: true }).click()
    await expect(
      inbox.getByRole('heading', { name: 'You’re all caught up', exact: true }),
    ).toBeVisible()
  })
}

test('inbox keeps read actions and validates destinations after the redesign', async ({
  page,
}) => {
  await notificationScenario(page)
  let target = 'https://example.com/unsafe'
  let reads = 0
  await page.route('**/v1/notifications/' + id(71) + '/navigation', (route) =>
    route.fulfill({ json: { surface: 'STOREFRONT', path: target } }),
  )
  await page.route('**/v1/notifications/read-all', (route) => {
    reads++
    expect(
      Number.isFinite(Date.parse(route.request().postDataJSON().before)),
    ).toBe(true)
    return route.fulfill({ json: { changed: 1 } })
  })
  await page.goto('/account/notifications')
  await page
    .getByRole('button', { name: 'Mark all as read', exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'All current messages marked as read.' }),
  ).toBeVisible()
  expect(reads).toBe(1)
  await page
    .getByRole('button', {
      name: 'Open notification: Order placed',
      exact: true,
    })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'Notification inbox', exact: true })
      .getByRole('alert'),
  ).toContainText('Notification destination is unavailable.')
  await expect(page).toHaveURL(/\/account\/notifications$/)
  target = '/account/orders/' + id(80)
  await page
    .getByRole('button', {
      name: 'Open notification: Order placed',
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(new RegExp('/account/orders/' + id(80) + '$'))
})

test('notification settings requires an authenticated account', async ({
  page,
}) => {
  await mock(page)
  await page.goto('/account/notification-settings')
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.getByRole('switch')).toHaveCount(0)
})

test('notification preferences preload once and refresh after a revisioned save', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0,
    saved
  let preferences = {
    revision: 0,
    securityEmailRequired: true,
    transactionalInAppRequired: true,
    operationalInApp: false,
  }
  await page.route('**/v1/notifications/preferences', (route) => {
    if (route.request().method() === 'PUT') {
      saved = route.request().postDataJSON()
      preferences = { ...preferences, ...saved, revision: 1 }
      return route.fulfill({ json: preferences })
    }
    reads++
    return route.fulfill({ json: preferences })
  })
  await page.route('**/v1/notifications?**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, unread: 0, page: 1, pages: 0 },
    }),
  )
  await page.goto('/shop')
  await expect.poll(() => reads).toBe(1)
  await page
    .locator('header')
    .getByRole('link', { name: 'Inbox', exact: true })
    .click()
  await page
    .getByRole('link', { name: 'Notification settings', exact: true })
    .click()
  const save = page.getByRole('button', {
    name: 'Save notification preferences',
    exact: true,
  })
  await expect(save).toBeEnabled()
  expect(reads).toBe(1)
  await page
    .getByRole('switch', { name: 'Store updates in your inbox', exact: true })
    .check()
  await save.click()
  await expect(
    page.getByText('Notification preferences saved.', { exact: true }),
  ).toBeVisible()
  await expect.poll(() => reads).toBe(2)
  expect(saved.expectedRevision).toBe(0)
  expect(saved.operationalInApp).toBe(true)
  await expect(
    page.getByRole('switch', {
      name: 'Store updates in your inbox',
      exact: true,
    }),
  ).toBeChecked()
})

test('a cold address read leaves checkout visible and is shared with session preload', async ({
  page,
}) => {
  await checkoutScenario(page, 2)
  let calls = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/account/addresses', async (route) => {
    calls++
    await gate
    await route.fulfill({ json: { items: [], count: 0 } })
  })
  try {
    await page.goto('/checkout')
    await expect(
      page.getByRole('heading', { name: 'Order summary', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', {
        name: 'Loading delivery addresses',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Loading checkout…', { exact: true }),
    ).toHaveCount(0)
    expect(calls).toBe(1)
  } finally {
    release()
  }
  await expect(
    page.getByRole('link', {
      name: 'Add a saved delivery address',
      exact: true,
    }),
  ).toBeVisible()
})

test('editing a saved address invalidates preloaded data before returning to checkout', async ({
  page,
}) => {
  await checkoutScenario(page, 2)
  let city = 'Before edit',
    reads = 0
  const address = {
    id: id(71),
    label: 'Home',
    recipientName: 'Customer',
    phone: '+12025550123',
    addressLine1: '1 Checkout Street',
    addressLine2: '',
    city,
    region: '',
    postalCode: '',
    countryCode: 'US',
    isDefault: true,
  }
  await page.route('**/v1/account/addresses', (route) => {
    reads++
    return route.fulfill({ json: { items: [{ ...address, city }], count: 1 } })
  })
  await page.route('**/v1/account/addresses/' + id(71), (route) => {
    city = route.request().postDataJSON().city
    return route.fulfill({ json: { ...address, city } })
  })
  await page.goto('/account/addresses')
  await expect(
    page.getByText('Before edit', { exact: false }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit address', exact: true }).click()
  await page.getByLabel('City', { exact: true }).fill('After edit')
  await page.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(
    page.getByText('After edit', { exact: false }).first(),
  ).toBeVisible()
  expect(reads).toBe(2)
  await page.getByRole('button', { name: 'Open cart', exact: false }).click()
  await page
    .getByRole('link', { name: 'Continue to checkout', exact: true })
    .click()
  await expect(
    page.getByLabel('Delivery address').getByRole('option', { selected: true }),
  ).toContainText('After edit')
  expect(reads).toBe(2)
})

test('refreshing an expired address updates delivery pricing when the same address changes country', async ({
  page,
}) => {
  await checkoutScenario(page, 2)
  await page.addInitScript(() => {
    const currentTime = Date.now
    window.cacheTimeOffset = 0
    Date.now = () => currentTime() + window.cacheTimeOffset
  })
  let addressReads = 0
  const countries = []
  await page.route('**/v1/account/addresses', (route) => {
    addressReads++
    return route.fulfill({
      json: {
        items: [
          {
            id: id(70),
            label: 'Home',
            recipientName: 'Customer',
            phone: '+12025550123',
            addressLine1: '1 Checkout Street',
            addressLine2: '',
            city: 'Example',
            region: '',
            postalCode: '',
            countryCode: addressReads === 1 ? 'US' : 'FR',
            isDefault: true,
          },
        ],
        count: 1,
      },
    })
  })
  await page.route('**/v1/checkout/delivery-options', (route) => {
    const countryCode = route.request().postDataJSON().countryCode
    countries.push(countryCode)
    const shippingMinor = countryCode === 'FR' ? 500 : 0
    return route.fulfill({
      json: {
        countryCode,
        currency: 'USD',
        subtotalMinor: 3998,
        discountMinor: 0,
        options: [
          {
            kind: null,
            label: 'Standard',
            shippingMinor,
            taxMinor: 0,
            totalMinor: 3998 + shippingMinor,
            etaNote: '',
          },
        ],
      },
    })
  })
  await page.goto('/shop')
  await expect.poll(() => addressReads).toBe(1)
  await page.evaluate(() => {
    window.cacheTimeOffset = 300001
  })
  await page.getByRole('button', { name: 'Open cart', exact: false }).click()
  await page
    .getByRole('link', { name: 'Continue to checkout', exact: true })
    .click()
  await expect.poll(() => countries).toContain('FR')
  await expect(
    page.getByRole('group', { name: 'Delivery service', exact: true }),
  ).toContainText('$5.00')
  expect(addressReads).toBe(2)
})

test('account-link intent preloads recent orders and explicit refresh bypasses the cache', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let reads = 0
  await page.route('**/v1/orders?**', (route) => {
    reads++
    return route.fulfill({
      json: { items: [], total: 0, page: 1, limit: 20, pages: 0 },
    })
  })
  const profilePreload = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/v1/account/profile',
  )
  await page.goto('/shop')
  await profilePreload
  await page
    .locator('header')
    .getByRole('link', { name: 'Account', exact: true })
    .hover()
  await expect.poll(() => reads).toBe(1)
  await page
    .locator('footer')
    .getByRole('link', { name: 'Your orders', exact: true })
    .click()
  await expect(
    page.getByText('No orders on this account.', { exact: true }),
  ).toBeVisible()
  expect(reads).toBe(1)
  await page
    .getByRole('button', { name: 'Refresh orders', exact: true })
    .click()
  await expect.poll(() => reads).toBe(2)
})

test('order-link intent warms the order and its ledgers before navigation', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  const orderId = id(80)
  const order = {
    ...pendingCheckoutOrder('PAID'),
    countryCode: 'US',
    deliveryKind: null,
    createdAt: new Date().toISOString(),
    fulfillment: null,
    shippingAddress: {
      recipientName: 'Customer',
      phone: '+12025550123',
      addressLine1: '1 Order Street',
      addressLine2: null,
      city: 'Example',
      region: null,
      postalCode: null,
      countryCode: 'US',
    },
  }
  let reads = 0
  await page.route('**/v1/orders?**', (route) =>
    route.fulfill({
      json: { items: [order], total: 1, page: 1, limit: 20, pages: 1 },
    }),
  )
  await page.route('**/v1/orders/' + orderId + '**', (route) => {
    reads++
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      json: path.endsWith('/tracking')
        ? {
            orderId,
            orderStatus: 'PAID',
            originalShipment: null,
            returns: [],
            replacements: [],
            events: [],
          }
        : path.endsWith(orderId)
          ? order
          : [],
    })
  })
  await page.route('**/v1/payments/orders/' + orderId + '/refunds', (route) => {
    reads++
    return route.fulfill({ json: [] })
  })
  await page.goto('/account/orders')
  const link = page.getByRole('link', { name: orderId, exact: true })
  await link.hover()
  await expect.poll(() => reads).toBe(5)
  await link.click()
  await expect(
    page.getByText('No delivery events recorded.', { exact: true }),
  ).toBeVisible()
  expect(reads).toBe(5)
  await page.getByRole('button', { name: 'Refresh order', exact: true }).click()
  await expect.poll(() => reads).toBe(10)
})

test('switching accounts rejects a delayed address response and clears the previous profile', async ({
  page,
}) => {
  await mock(page, { authenticated: true })
  let current = user,
    calls = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        accessToken: 'controlled-account-switch-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: current,
      },
    }),
  )
  await page.route('**/v1/auth/me', (route) => route.fulfill({ json: current }))
  await page.route('**/v1/account/profile', (route) =>
    route.fulfill({
      json: {
        ...current,
        displayName:
          current.id === user.id ? 'Private account A' : 'Private account B',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      },
    }),
  )
  await page.route('**/v1/account/addresses', async (route) => {
    const owner = current.id
    calls++
    if (owner === user.id) await gate
    await route.fulfill({ json: { items: [], count: 0 } }).catch(() => {})
  })
  try {
    await page.goto('/account')
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'Private account A',
    )
    current = { ...user, id: id(97), email: 'another@example.test' }
    await page.evaluate(() => {
      const channel = new BroadcastChannel('eshop-auth-customer')
      channel.postMessage({ type: 'login', source: 'other-cache-test-tab' })
      channel.close()
    })
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'Private account B',
    )
    release()
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
      'Private account B',
    )
    await expect(
      page.getByText('fixture@example.test', { exact: true }),
    ).toHaveCount(0)
    expect(calls).toBeGreaterThanOrEqual(2)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('ordinary checkout defers recovery until payment and ignores duplicate clicks while recovering', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  let recoveryCalls = 0
  let starts = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/checkout/recovery', async (route) => {
    recoveryCalls++
    await gate
    await route.fulfill({ json: { reservation: null, orderId: null } })
  })
  await page.route('**/v1/checkout/start', (route) => {
    starts++
    return route.fulfill({ json: scenario.session() })
  })
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await expect(pay).toBeEnabled()
  expect(recoveryCalls).toBe(0)
  await expect(
    page.getByText('Restoring checkout…', { exact: true }),
  ).toHaveCount(0)
  try {
    await pay.evaluate((button) => {
      button.click()
      button.click()
    })
    await expect.poll(() => recoveryCalls).toBe(1)
    await expect(page.locator('button[aria-busy="true"]')).toBeDisabled()
    await expect(
      page.getByRole('progressbar', { name: 'Preparing Stripe Checkout' }),
    ).toHaveAttribute('aria-valuetext', 'Checking for an existing checkout…')
    expect(starts).toBe(0)
  } finally {
    release()
  }
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toBe(1)
})

for (const width of [390, 1440]) {
  test(`checkout shows real request stages and progress until Stripe opens at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const scenario = await checkoutScenario(page, 2)
    let releaseStart, releaseStripe
    const startGate = new Promise((resolve) => {
      releaseStart = resolve
    })
    const stripeGate = new Promise((resolve) => {
      releaseStripe = resolve
    })
    await page.route('**/v1/checkout/start', async (route) => {
      await startGate
      await route.fulfill({ json: scenario.session() })
    })
    await page.route('https://checkout.stripe.com/**', async (route) => {
      await stripeGate
      await route.fulfill({
        contentType: 'text/html',
        body: '<h1>Stripe payment fixture</h1>',
      })
    })
    const progress = page.getByRole('progressbar', {
      name: 'Preparing Stripe Checkout',
    })
    try {
      await page.goto('/checkout')
      await expect(progress).toHaveCount(0)
      await page
        .getByRole('button', {
          name: 'Continue to Stripe Checkout',
          exact: true,
        })
        .click()
      const dialog = page.getByRole('dialog', {
        name: 'Preparing your checkout',
        exact: true,
      })
      await expect(dialog).toBeVisible()
      const steps = dialog.getByRole('listitem')
      await expect(steps).toHaveCount(3)
      await expect(steps.nth(0)).toContainText('Completed')
      await expect(steps.nth(1)).toContainText('In progress')
      await expect(steps.nth(2)).toContainText('Waiting')
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await page.mouse.click(2, 2)
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Tab')
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true)
      await expect(progress).toBeVisible()
      await expect(progress).toHaveAttribute(
        'aria-valuetext',
        'Checking stock, reserving items and preparing payment…',
      )
      await expect(progress).not.toHaveAttribute('aria-valuenow')
      await expect(
        page.getByText(
          'Finish saving your cart and resolve any cart errors before continuing.',
          { exact: true },
        ),
      ).toHaveCount(0)
      const bounds = await progress.boundingBox()
      expect(bounds.y).toBeGreaterThanOrEqual(0)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900)
      expect(
        await progress
          .locator('span')
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe('none')
      await expect(
        page.getByText(
          'Your checkout could not be confirmed. Retry the same checkout to continue.',
          { exact: true },
        ),
      ).toBeHidden()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: info.outputPath('checkout-progress.png'),
        fullPage: false,
      })
      releaseStart()
      await expect(progress).toHaveAttribute(
        'aria-valuetext',
        'Opening Stripe Checkout…',
      )
      releaseStripe()
      await page.waitForURL('https://checkout.stripe.com/**')
    } finally {
      releaseStart()
      releaseStripe()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
}

test('payment click resumes a recovered unpaid order without creating another checkout', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  let starts = 0
  let resumes = 0
  await page.route('**/v1/checkout/recovery', (route) =>
    route.fulfill({ json: { reservation: null, orderId: id(80) } }),
  )
  await page.route('**/v1/orders/' + id(80), (route) =>
    route.fulfill({ json: pendingCheckoutOrder() }),
  )
  await page.route('**/v1/payments/orders/' + id(80), (route) =>
    route.fulfill({ json: { checkoutStarted: true } }),
  )
  await page.route('**/v1/checkout/orders/' + id(80) + '/reconcile', (route) =>
    route.fulfill({ json: pendingCheckoutOrder() }),
  )
  await page.route('**/v1/checkout/orders/' + id(80) + '/session', (route) => {
    resumes++
    return route.fulfill({ json: scenario.session() })
  })
  await page.route('**/v1/checkout/start', (route) => {
    starts++
    return route.fulfill({ json: scenario.session() })
  })
  await page.goto('/checkout')
  await page
    .getByRole('button', { name: 'Continue to Stripe Checkout', exact: true })
    .click()
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(resumes).toBe(1)
  expect(starts).toBe(0)
})

test('recovery failure prevents a fresh checkout and allows another payment attempt', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  let recoveryCalls = 0
  let starts = 0
  await page.route('**/v1/checkout/recovery', (route) => {
    recoveryCalls++
    return route.fulfill(
      recoveryCalls === 1
        ? { status: 503, json: { message: 'Checkout recovery unavailable' } }
        : { json: { reservation: null, orderId: null } },
    )
  })
  await page.route('**/v1/checkout/start', (route) => {
    starts++
    return route.fulfill({ json: scenario.session() })
  })
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await pay.click()
  await expect(
    page.getByText(
      'The service is temporarily unavailable. Please try again.',
      { exact: true },
    ),
  ).toBeVisible()
  expect(starts).toBe(0)
  await expect(pay).toBeEnabled()
  await expect(
    page.getByRole('dialog', { name: 'Preparing your checkout', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('progressbar', { name: 'Preparing Stripe Checkout' }),
  ).toHaveCount(0)
  await pay.click()
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toBe(1)
})

test('payment click exposes a recovered standalone stock hold for release before starting again', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  let starts = 0
  let released = false
  const reservation = {
    ...pendingCheckoutOrder(),
    id: id(81),
    requestId: id(82),
    status: 'ACTIVE',
    countryCode: 'US',
    deliveryKind: null,
    couponCode: null,
    estimatedTotalMinor: 3998,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    payable: false,
  }
  await page.route('**/v1/checkout/recovery', (route) =>
    route.fulfill({
      json: { reservation: released ? null : reservation, orderId: null },
    }),
  )
  await page.route('**/v1/checkout/reservations/' + id(81), (route) => {
    released = true
    return route.fulfill({ json: { ...reservation, status: 'RELEASED' } })
  })
  await page.route('**/v1/checkout/start', (route) => {
    starts++
    return route.fulfill({ json: scenario.session() })
  })
  await page.goto('/checkout')
  await page
    .getByRole('button', { name: 'Continue to Stripe Checkout', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Release previous stock hold',
      exact: true,
    }),
  ).toBeEnabled()
  expect(starts).toBe(0)
  await page
    .getByRole('button', { name: 'Release previous stock hold', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue to Stripe Checkout', exact: true })
    .click()
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toBe(1)
})

test('checkout reports 12 requested versus 10 available, saves the suggested quantity and then opens Stripe', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const scenario = await checkoutScenario(page)
  const starts = []
  await page.route('**/v1/checkout/start', async (route) => {
    starts.push(route.request().postDataJSON())
    return route.fulfill(
      (await scenario.quantity()) > 10
        ? { status: 409, json: scenario.shortage(10) }
        : { json: scenario.session() },
    )
  })
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await expect(pay).toBeEnabled()
  await expect(page.getByText('Tax', { exact: true })).toHaveCount(0)
  await pay.click()
  await expect(
    page.getByRole('region', { name: 'Stock availability' }),
  ).toContainText('You requested 12. Only 10 are currently available.')
  await expect(pay).toBeDisabled()
  await page.screenshot({
    path: info.outputPath('checkout-stock-shortage.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Update quantity to 10', exact: true })
    .click()
  await expect.poll(() => scenario.quantity()).toBe(10)
  await expect(pay).toBeEnabled()
  await pay.click()
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toHaveLength(2)
  expect(starts[0].requestId).not.toBe(starts[1].requestId)
  expect(starts[1]).not.toHaveProperty('priceMinor')
  await expect(page.getByText('Stripe Checkout opened')).toBeVisible()
})

test('checkout with zero available stock offers removal and does not redirect', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page)
  await page.route('**/v1/checkout/start', (route) =>
    route.fulfill({ status: 409, json: scenario.shortage(0) }),
  )
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await expect(pay).toBeEnabled()
  await pay.click()
  await expect(
    page.getByRole('region', { name: 'Stock availability' }),
  ).toContainText('Only 0 are currently available.')
  await expect(
    page.getByRole('button', { name: 'Update quantity', exact: false }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove item', exact: true }).click()
  await expect.poll(() => scenario.quantity()).toBe(0)
  await expect(pay).toBeDisabled()
  await expect(
    page.getByRole('region', { name: 'Stock availability' }),
  ).toHaveCount(0)
})

test('uncertain checkout retries the same frozen request before redirecting to Stripe', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  const starts = []
  await page.route('**/v1/checkout/start', async (route) => {
    starts.push(route.request().postDataJSON())
    return route.fulfill(
      starts.length === 1
        ? { status: 503, json: { message: 'Checkout uncertain' } }
        : { json: scenario.session() },
    )
  })
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await expect(pay).toBeEnabled()
  await pay.click()
  const retry = page.getByRole('button', {
    name: 'Retry checkout',
    exact: true,
  })
  await expect(retry).toBeEnabled()
  expect(starts).toHaveLength(1)
  await retry.click()
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toHaveLength(2)
  expect(starts[1]).toEqual(starts[0])
})

function pendingCheckoutOrder(status = 'PENDING_PAYMENT') {
  return {
    id: id(80),
    reservationId: id(81),
    requestId: id(82),
    status,
    currency: 'USD',
    subtotalMinor: 3998,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    totalMinor: 3998,
    lines: [],
    paymentDeadlineAt: new Date(Date.now() + 31 * 60000).toISOString(),
    paidAt: status === 'PAID' ? new Date().toISOString() : null,
  }
}

for (const changedCart of [false, true])
  test(`Stripe success clears the matching local cart and preserves ${changedCart ? 'later edits' : 'pending items until verified'}`, async ({
    page,
  }) => {
    await checkoutScenario(page, 2)
    let paid = false,
      checks = 0
    await page.route('**/v1/orders/' + id(80), (route) =>
      route.fulfill({ json: pendingCheckoutOrder() }),
    )
    await page.route('**/v1/payments/orders/' + id(80), (route) =>
      route.fulfill({
        json: {
          checkoutStarted: true,
          provider: 'STRIPE_TEST',
          preparationStatus: 'AWAITING_WEBHOOK',
        },
      }),
    )
    await page.route(
      '**/v1/checkout/orders/' + id(80) + '/reconcile',
      (route) => {
        checks++
        return route.fulfill({
          json: pendingCheckoutOrder(paid ? 'PAID' : 'PENDING_PAYMENT'),
        })
      },
    )
    await page.goto('/checkout?order=' + id(80) + '&result=success')
    await expect(
      page.getByText('PENDING_PAYMENT', { exact: true }),
    ).toBeVisible()
    await page.evaluate(
      ({ key, requestId, changedCart }) => {
        const saved = JSON.parse(localStorage.getItem(key))
        saved.checkout = {
          requestId,
          items: saved.cart.items.map(
            ({ id, productId, variantId, quantity }) => ({
              id,
              productId,
              variantId,
              quantity,
            }),
          ),
        }
        if (changedCart) {
          saved.cart.items[0].quantity = 3
          saved.cart.items[0].lineTotalMinor = 5997
          saved.cart.subtotalMinor = 5997
        }
        localStorage.setItem(key, JSON.stringify(saved))
      },
      { key: 'eshop-cart-v1:' + user.id, requestId: id(82), changedCart },
    )
    await expect(
      page.getByText('Payment confirmed. Your order is placed.', {
        exact: true,
      }),
    ).toHaveCount(0)
    paid = true
    await page
      .getByRole('button', { name: 'Refresh payment status', exact: true })
      .click()
    await expect(
      page.getByText('Payment confirmed. Your order is placed.', {
        exact: true,
      }),
    ).toBeVisible()
    expect(checks).toBeGreaterThanOrEqual(2)
    const remaining = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).cart.items,
      'eshop-cart-v1:' + user.id,
    )
    expect(remaining).toHaveLength(changedCart ? 1 : 0)
  })

test('Stripe cancel return expires the server checkout before showing a cancelled order', async ({
  page,
}) => {
  await checkoutScenario(page, 2)
  let cancelled = false
  await page.route('**/v1/checkout/orders/' + id(80) + '/cancel', (route) => {
    cancelled = true
    return route.fulfill({ json: pendingCheckoutOrder('CANCELLED') })
  })
  await page.route('**/v1/orders/' + id(80), (route) =>
    route.fulfill({
      json: pendingCheckoutOrder(cancelled ? 'CANCELLED' : 'PENDING_PAYMENT'),
    }),
  )
  await page.route('**/v1/payments/orders/' + id(80), (route) =>
    route.fulfill({
      json: { checkoutStarted: true, preparationStatus: 'CANCELLED' },
    }),
  )
  await page.goto('/checkout?order=' + id(80) + '&result=cancel')
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
  expect(cancelled).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Return to checkout', exact: true }),
  ).toBeEnabled()
})

test('an account change during checkout prevents the old Stripe redirect', async ({
  page,
}) => {
  const scenario = await checkoutScenario(page, 2)
  let release,
    started = false
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/v1/checkout/start', async (route) => {
    started = true
    await gate
    await route.fulfill({ json: scenario.session() }).catch(() => {})
  })
  try {
    await page.goto('/checkout')
    const pay = page.getByRole('button', {
      name: 'Continue to Stripe Checkout',
      exact: true,
    })
    await expect(pay).toBeEnabled()
    await pay.click()
    await expect.poll(() => started).toBe(true)
    await page.evaluate(() => {
      const channel = new BroadcastChannel('eshop-auth-customer')
      channel.postMessage({ type: 'logout', source: 'other-checkout-tab' })
      channel.close()
    })
    release()
    await expect(page).toHaveURL(/sign-in/)
    expect(new URL(page.url()).hostname).toBe('127.0.0.1')
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

for (const authenticated of [false, true]) {
  test(`${authenticated ? 'account' : 'guest'} local cart adds immediately, accepts entry and plus/minus, and persists without any cart request`, async ({
    page,
  }, info) => {
    await mock(page, { authenticated })
    const requests = []
    page.on('request', (request) => {
      if (
        /\/(?:v1\/(?:cart|guest-cart)|api\/cart)(?:[/?]|$)/.test(request.url())
      )
        requests.push(request.url())
    })
    await openControlled(page, '/')
    await page
      .getByRole('button', { name: 'Add to cart', exact: true })
      .first()
      .click()
    const drawer = page.getByRole('dialog', { name: 'Your cart' })
    const input = drawer.getByLabel('Quantity for ' + products[0].title, {
      exact: true,
    })
    await expect(input).toHaveValue('1')
    await expect(
      drawer.getByText(/Checking your cart|Saving|Syncing/i),
    ).toHaveCount(0)
    await input.fill('12')
    await expect(input).toHaveValue('12')
    await drawer
      .getByRole('button', {
        name: 'Increase quantity for ' + products[0].title,
        exact: true,
      })
      .click()
    await expect(input).toHaveValue('13')
    await drawer
      .getByRole('button', {
        name: 'Decrease quantity for ' + products[0].title,
        exact: true,
      })
      .click()
    await expect(input).toHaveValue('12')
    await expect(
      drawer.getByText('$239.88', { exact: true }).first(),
    ).toBeVisible()
    await expect(
      drawer.getByRole('button', { name: 'Update quantity', exact: true }),
    ).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('local-cart-quantity.png') })
    await drawer
      .getByRole('link', { name: 'Open full cart', exact: true })
      .click()
    await page.reload()
    await expect(
      page.getByLabel('Quantity for ' + products[0].title, { exact: true }),
    ).toHaveValue('12')
    await page.getByRole('button', { name: 'Remove item', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Your cart is empty', exact: true }),
    ).toBeVisible()
    expect(requests).toEqual([])
  })
}

test('local cart updates propagate to another tab without a network cart read', async ({
  page,
  context,
}) => {
  await mock(page, { authenticated: true, initialCart: cart })
  await page.goto('/cart')
  const other = await context.newPage()
  await mock(other, { authenticated: true })
  await other.goto('/cart')
  const label = 'Quantity for ' + products[0].sku
  await expect(other.getByLabel(label, { exact: true })).toHaveValue('1')
  await page.getByLabel(label, { exact: true }).fill('5')
  await expect(other.getByLabel(label, { exact: true })).toHaveValue('5')
  await other.close()
})

test('storage quota failure retains subsequent local quantity edits in memory', async ({
  page,
}) => {
  await mock(page, { authenticated: true, initialCart: cart })
  await page.goto('/cart')
  const quantity = page.getByLabel('Quantity for ' + products[0].sku, {
    exact: true,
  })
  await expect(quantity).toHaveValue('1')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('eshop-cart-v1:'))
        throw new DOMException('Storage is full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await quantity.fill('2')
  await expect(
    page.getByText(
      'Browser storage is unavailable. Keep this tab open to retain your cart.',
      { exact: true },
    ),
  ).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Increase quantity for ' + products[0].sku,
      exact: true,
    })
    .click()
  await expect(quantity).toHaveValue('3')
  await expect(page.getByText('$59.97', { exact: true }).first()).toBeVisible()
})

test('checkout receipt waits for a concurrent cart edit and preserves its newer quantity', async ({
  page,
  context,
}) => {
  const scenario = await checkoutScenario(page, 2)
  const other = await context.newPage()
  await mock(other, { authenticated: true })
  await other.goto('/cart')
  const starts = []
  await page.route('**/v1/checkout/start', (route) => {
    starts.push(route.request().postDataJSON())
    return route.fulfill({ json: scenario.session() })
  })
  await page.goto('/checkout')
  const pay = page.getByRole('button', {
    name: 'Continue to Stripe Checkout',
    exact: true,
  })
  await expect(pay).toBeEnabled()
  await other.evaluate(async () => {
    let acquired
    const held = new Promise((resolve) => {
      acquired = resolve
    })
    const gate = new Promise((resolve) => {
      window.releaseCartEdit = resolve
    })
    window.cartEdit = navigator.locks.request('eshop-local-cart', async () => {
      acquired()
      await gate
    })
    await held
  })
  try {
    await pay.click()
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.locks.query()).pending.filter(
              (lock) => lock.name === 'eshop-local-cart',
            ).length,
        ),
      )
      .toBe(1)
    expect(starts).toHaveLength(0)
    await other.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key))
      saved.cart.items[0].quantity = 3
      saved.cart.items[0].lineTotalMinor = 5997
      saved.cart.subtotalMinor = 5997
      localStorage.setItem(key, JSON.stringify(saved))
      window.releaseCartEdit()
    }, 'eshop-cart-v1:' + user.id)
    await page.waitForURL('https://checkout.stripe.com/**')
    expect(starts[0].items[0].quantity).toBe(2)
    const retained = await other.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).cart.items[0].quantity,
      'eshop-cart-v1:' + user.id,
    )
    expect(retained).toBe(3)
  } finally {
    await other.evaluate(() => window.releaseCartEdit?.()).catch(() => {})
    await other.close()
  }
})
