import type { Dictionary } from "../translate"

// Hindi (pilot language for Multi-language Phase 1). Nav-chrome scope only
// - see locales.ts for the phase boundaries. Mix of plain Hindi and
// widely-understood transliterations (डैशबोर्ड, प्रोफ़ाइल) rather than
// pure literary Hindi - matches how most Indian consumer apps localize,
// picked for immediate everyday readability over formal correctness.
const hi: Dictionary = {
  nav: {
    events: "इवेंट्स",
    artists: "कलाकार",
    venues: "स्थल",
    wallOfFame: "वॉल ऑफ़ फ़ेम",
    back: "← वापस",
    dashboard: "डैशबोर्ड",
    messages: "संदेश",
    myTickets: "मेरे टिकट",
    profile: "प्रोफ़ाइल",
    greeting: "नमस्ते,",
    signedInAs: "इस रूप में साइन इन:",
    signIn: "साइन इन करें",
    signUp: "साइन अप करें",
    signOut: "साइन आउट करें",
  },
  roles: {
    VENUE_OWNER: "स्थल स्वामी",
    ARTIST: "कलाकार",
    ORGANISER: "आयोजक",
    ADMIN: "एडमिन",
    AUDIENCE: "दर्शक",
  },
  languagePicker: {
    label: "भाषा",
  },
  search: {
    placeholder: "इवेंट्स, कलाकार, स्थल खोजें...",
    searching: "खोज जारी है...",
    noResultsFor: '"{query}" के लिए कोई परिणाम नहीं',
  },
  location: {
    searchCityPlaceholder: "शहर खोजें...",
    noMatchingCities: "कोई मिलता-जुलता शहर नहीं",
  },
}

export default hi
