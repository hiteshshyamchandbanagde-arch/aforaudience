// BUG-2610-016 - axis labels for the admin Revenue chart. Bucket keys
// come from bucketKeyFor() (src/lib/sales-range.ts): "YYYY-MM" for
// monthly buckets, "YYYY-MM-DD" for daily/weekly ones. The chart used to
// print key.slice(5) - "09", "10" - rotated 90°. Now: "Sep", "Oct" (or
// "30 Sep"), with the year only when the buckets span more than one year.
// English month names, like the rest of the admin dashboard.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function timelineLabels(keys: string[]): string[] {
  const years = new Set(keys.map((k) => k.slice(0, 4)))
  const withYear = years.size > 1
  return keys.map((key) => {
    const [y, m, d] = key.split('-')
    const month = MONTHS[Number(m) - 1] ?? key
    const base = d ? `${Number(d)} ${month}` : month
    return withYear ? `${base} ${y}` : base
  })
}
