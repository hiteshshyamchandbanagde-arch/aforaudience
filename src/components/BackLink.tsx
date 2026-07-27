'use client'

import Link from 'next/link'

// Feedback 5b3ba5cf: 27+ pages each rolled their own back-link text/style
// independently - confirmed real inconsistency before building (some said
// "Back to Home" with no arrow, others "← Back to Dashboard", others
// "← Back to venue" with inconsistent casing). One shared component,
// standard arrow + Title Case, dropped in wherever a page needs a
// "go back" link below the main nav.
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--afa-terracotta)',
        textDecoration: 'none',
        marginBottom: '16px',
      }}
    >
      ← {label}
    </Link>
  )
}
