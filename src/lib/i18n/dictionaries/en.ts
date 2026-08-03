// Source-of-truth key set for Multi-language Phase 1. Every other
// dictionary (hi.ts, and future te/ta/kn/ml.ts) must implement this exact
// key shape - see the Dictionary type exported from ../translate.ts.
const en = {
  nav: {
    events: "Events",
    artists: "Artists",
    venues: "Venues",
    wallOfFame: "Wall of Fame",
    back: "← Back",
    dashboard: "Dashboard",
    messages: "Messages",
    myTickets: "My Tickets",
    profile: "Profile",
    greeting: "Hi,",
    signedInAs: "Signed in as",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
  },
  roles: {
    VENUE_OWNER: "Venue Owner",
    ARTIST: "Artist",
    ORGANISER: "Organiser",
    ADMIN: "Admin",
    AUDIENCE: "Audience",
  },
  languagePicker: {
    label: "Language",
  },
  themePicker: {
    label: "Theme",
  },
  search: {
    placeholder: "Search events, artists, venues...",
    searching: "Searching...",
    noResultsFor: 'No results for "{query}"',
  },
  location: {
    searchCityPlaceholder: "Search city...",
    noMatchingCities: "No matching cities",
  },
}

export default en
