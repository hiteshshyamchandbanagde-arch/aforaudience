import type { Dictionary } from '@/lib/i18n/translate'

// GEN-2610-007 - "Updated 12s ago" on the Organiser sales pages, in the UI
// language (organiserDashboard.sales.*Ago).
export function timeAgo(iso: string, s: Dictionary['organiserDashboard']['sales'], now: number = Date.now()) {
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (secs < 5) return s.justNow
  if (secs < 60) return s.secondsAgo.replace('{n}', String(secs))
  const mins = Math.floor(secs / 60)
  if (mins < 60) return s.minutesAgo.replace('{n}', String(mins))
  const hrs = Math.floor(mins / 60)
  return s.hoursAgo.replace('{n}', String(hrs))
}
