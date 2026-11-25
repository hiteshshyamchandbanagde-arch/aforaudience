// GEN-2610-007 - text helpers Create Event and Edit Event share, so both
// pages read organiserDashboard.eventForm the same way.
import type { Dictionary } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'
import { isUnusuallyLong, type VenueHireDuration } from '@/lib/venue-billing'

export type EventFormText = Dictionary['organiserDashboard']['eventForm']

/** Dropdown labels for the stored (English) Dress Code, Vibe and Age limit presets. */
export function presetLabels(f: EventFormText): Record<string, string> {
  return {
    'Casual': f.dressCasual,
    'Smart Casual': f.dressSmartCasual,
    'Formal': f.dressFormal,
    'Costume / Theme': f.dressCostume,
    'High Energy': f.vibeHighEnergy,
    'Intimate': f.vibeIntimate,
    'Chill': f.vibeChill,
    'Curated': f.vibeCurated,
    'Family-Friendly': f.vibeFamilyFriendly,
    'All ages': f.ageAll,
  }
}

/** 898 -> "14 h 58 m", in the UI language (venue-billing's formatDuration, translated). */
export function durationText(f: EventFormText, minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return f.durationMinutes.replace('{m}', String(m))
  if (m === 0) return f.durationHours.replace('{h}', String(h))
  return f.durationHoursMinutes.replace('{h}', String(h)).replace('{m}', String(m))
}

/** venue-billing's longEventWarning, translated: the note under the time fields, or null. */
export function longEventText(f: EventFormText, d: VenueHireDuration): string | null {
  if (!isUnusuallyLong(d)) return null
  const length = durationText(f, d.minutes)
  return (d.crossesMidnight ? f.longEventNextDay : f.longEvent).replace('{length}', length)
}

export function seatsText(locale: string, f: EventFormText, n: number): string {
  return countText(locale, n, f.seatsOne, f.seatsOther)
}

export function sectionsText(locale: string, f: EventFormText, n: number): string {
  return countText(locale, n, f.sectionsOne, f.sectionsOther)
}

/** The weekday of a yyyy-mm-dd date in the UI language ("Monday", "सोमवार"). */
export function weekdayName(locale: string, date: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(date + 'T00:00:00'))
  } catch {
    return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(date + 'T00:00:00'))
  }
}
