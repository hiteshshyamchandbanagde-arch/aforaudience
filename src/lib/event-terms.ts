// FEAT-2608-045 (11 Aug) - curated checklist for event-specific terms,
// deliberately NOT free text so an organiser can't accidentally write
// something that conflicts with AFA's own refund/cancellation policy.
// That policy is platform-wide and NOT stored/editable per-event - see
// REFUND_POLICY_LINK below, which points at the existing placeholder
// section on /terms rather than duplicating it here. Keys are stored on
// Event.termsChecklist; labels live here so wording can change without a
// migration. Add to this list, don't repurpose an existing key - old
// events keep whatever keys they were saved with.
export interface EventTermItem {
  key: string
  label: string
}

export const EVENT_TERMS_CHECKLIST: EventTermItem[] = [
  { key: "NO_OUTSIDE_FOOD", label: "No outside food or beverages" },
  { key: "NO_RECORDING", label: "No photography or recording during the show" },
  { key: "NO_RE_ENTRY", label: "No re-entry once you've exited" },
  { key: "LATECOMER_HOLD", label: "Latecomers seated only at a break/interval" },
  { key: "BAG_RESTRICTION", label: "Bag size or prohibited items restriction" },
  { key: "NO_PARKING", label: "Parking not provided at the venue" },
]
// AGE_RESTRICTION and DRESS_CODE removed (11 Aug, follow-up) - age limit
// is now a structured dropdown (AGE_LIMIT_PRESETS below, Event.ageLimit)
// instead of a plain checkbox that couldn't say what the limit actually
// was. Dress code merges into the event's existing `dresscode` field
// (Dress Code/Vibe on event creation) rather than a duplicate checklist
// item - the two meant slightly different things but read as redundant
// to fill in. Don't reintroduce these keys - old events that had them
// checked were migrated off in the same migration that added ageLimit.

export const EVENT_TERMS_CHECKLIST_KEYS = EVENT_TERMS_CHECKLIST.map((t) => t.key)

export const SPECIAL_NOTES_MAX_LENGTH = 300

// FEAT-2608-045 follow-up (11 Aug) - preset age-limit values, same
// "preset dropdown + Other free text" pattern as Dress Code/Vibe
// (PresetSelectWithOther). Plain string on Event.ageLimit, not an enum,
// so "Other" custom text stays cheap and doesn't need a migration to add
// a new preset later.
export const AGE_LIMIT_PRESETS = ["All ages", "13+", "16+", "18+", "21+"]

// FEAT-2608-045 (11 Aug) - AFA's refund/cancellation policy is
// platform-wide, not organiser-editable, and already has a placeholder
// section on /terms (§3 "Booking tickets") pending Hitesh's actual policy
// text - deliberately NOT duplicated here. Event pages and checkout link
// straight to that section rather than maintaining a second copy.
export const REFUND_POLICY_LINK = "/terms#booking"
