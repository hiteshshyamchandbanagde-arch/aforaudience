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
  },
  languagePicker: {
    label: "भाषा",
  },
}

export default hi
