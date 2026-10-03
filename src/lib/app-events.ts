// Window events that carry state between component trees that share no
// parent below the root layout (the global MobileTopBar and LocationChip
// on one side, a page's own filters on the other). Names live here so
// the sender and every listener use the same string.

// MobileTopBar's search input -> the page's search (detail: { query }).
export const MOBILE_SEARCH_EVENT = 'afa:mobile-search'
// MobileTopBar's filter icon -> /events opens its filter sheet.
export const MOBILE_SEARCH_OPEN_FILTERS_EVENT = 'afa:mobile-search-open-filters'
// BUG-2610-004 - /events -> MobileTopBar: the page's active search, so
// the top-bar input shows it (detail: { query }).
export const MOBILE_SEARCH_SYNC_EVENT = 'afa:mobile-search-sync'
// BUG-2609-078 - LocationChip, after the new city is saved -> /venues,
// /events and any other chip on the page (detail: { city, country }).
export const LOCATION_CHANGED_EVENT = 'afa:location-changed'

export type LocationChangedDetail = { city: string; country: string | null }
