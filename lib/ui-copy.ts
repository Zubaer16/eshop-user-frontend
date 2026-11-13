/** English storefront labels for the current interface. */
export const uiCopy = {
  shop: 'Shop',
  category: 'Category',
  categories: 'Categories',
  cart: 'Cart',
  wishlist: 'Wishlist',
  search: 'Search',
  searchPlaceholder: 'Search products, categories & more...',
  searchCatalog: 'Search the catalog',
  submitSearch: 'Submit search',
  close: 'Close',
  newArrivals: 'New arrivals',
  collections: 'All collections',
  errorTitle: "Something didn't load",
  errorDescription:
    'Please try again. If the problem continues, refresh the page.',
  tryAgain: 'Try again',
  notFound: 'Not found',
  missingTitle: 'This page went exploring.',
  missingDescription: 'The page or product you requested could not be found.',
  backHome: 'Back to home',
  account: 'Account',
} as const

export type UiKey = keyof typeof uiCopy
export function getUiCopy() {
  return uiCopy
}
