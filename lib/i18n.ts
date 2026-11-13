/** Customer-facing storefront copy (English only). */
const words = {
  shop: 'Shop',
  deals: 'Deals',
  categories: 'Categories',
  newArrivals: 'New arrivals',
  searchPlaceholder: 'Search products, categories, and more...',
  search: 'Search',
  cart: 'Cart',
  wishlist: 'Wishlist',
  account: 'Account',
  shopByCategory: 'Shop by category',
  freeShipping: 'Shipping offers on eligible orders',
  global: 'Explore our global selection in USD',
} as const

export function dictionary() {
  return words
}
