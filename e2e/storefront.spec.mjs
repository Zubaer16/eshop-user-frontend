import { test, expect } from '@playwright/test'

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
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Discover something new', exact: true }),
  ).toBeVisible()
  await page
    .locator('footer')
    .getByRole('link', { name: 'Shop all', exact: true })
    .click()
  await expect(page.locator('main article')).toHaveCount(10)
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
  expect(productReads).toBe(1)
  await page
    .locator('header')
    .getByRole('link', { name: 'eShop home', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Discover something new', exact: true }),
  ).toBeVisible()
  expect(homeReads).toBe(1)
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
  await page.goto('/shop')
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
  ...p,
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

async function mock(
  page,
  { authenticated = false, configured = false, singleBanner = false } = {},
) {
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
  await page.route('**/api/cart/guest', (route) =>
    route.fulfill({ json: { guest: false, cart: emptyCart } }),
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
    else if (path === '/v1/cart') data = cart
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
    await page.goto('/')
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
  await page.goto('/')
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
  await page.goto('/shop')
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
  const request = page.waitForRequest(
    (r) =>
      r.url().includes('/v1/products?') &&
      new URL(r.url()).searchParams.get('category') === 'audio',
  )
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await request
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
    await mock(page, { authenticated: true })
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
    await page.route('**/api/cart/guest', (route) =>
      route.fulfill({ json: { guest: false, cart: emptyCart } }),
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

test('product options and quantity keep canonical identity and reject a failed write without optimistic success', async ({
  page,
  request,
}, info) => {
  const productResponse = await request.get(
    process.env.ESHOP_API_URL + '/v1/products/non-slip-yoga-mat',
  )
  expect(productResponse.status()).toBe(200)
  const real = await productResponse.json()
  const variant = {
    id: id(90),
    productId: real.id,
    sku: 'CONTROLLED-L-BLUE',
    options: { size: 'Large', color: 'Blue' },
    priceMinor: 2499,
    stockOnHand: 10,
    available: true,
  }
  await mock(page, { authenticated: true })
  await page.route('**/v1/products/non-slip-yoga-mat', (route) =>
    route.fulfill({
      json: { ...real, hasVariants: true, variants: [variant] },
    }),
  )
  await page.goto('/product/non-slip-yoga-mat')
  const group = page.getByRole('group', { name: 'Size / color', exact: true })
  await expect(group).toBeVisible()
  const add = page
    .getByRole('button', { name: 'Add to cart', exact: true })
    .first()
  await expect(add).toBeDisabled()
  const option = group.getByRole('button', { name: /Large \/ Blue/ })
  await option.click()
  await expect(option).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(
    page.getByRole('spinbutton', { name: 'Quantity', exact: true }),
  ).toHaveValue('2')
  const write = page.waitForRequest(
    (r) =>
      r.method() === 'PUT' && new URL(r.url()).pathname === '/v1/cart/items',
  )
  await add.click()
  const mutation = await write
  expect(mutation.postDataJSON()).toEqual({
    productId: real.id,
    variantId: variant.id,
    quantity: 2,
  })
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Controlled write blocked',
  )
  await page.screenshot({
    path: info.outputPath('product-options.png'),
    fullPage: true,
  })
})

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
  await page.goto('/shop')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Retry loading', exact: true }),
  ).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(0)
})
