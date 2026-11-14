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
  await openControlled(page, '/shop')
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
  await page.goto('/categories')
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

test('catalog failure shows recovery UI without substituting sample products', async ({
  page,
}) => {
  await mock(page)
  await page.route('**/v1/products?**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await openControlled(page, '/shop')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Retry loading', exact: true }),
  ).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(0)
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
    await expect(
      page.getByRole('button', { name: 'Preparing checkout…', exact: true }),
    ).toBeDisabled()
    expect(starts).toBe(0)
  } finally {
    release()
  }
  await page.waitForURL('https://checkout.stripe.com/**')
  expect(starts).toBe(1)
})

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
