import type { CSSProperties } from 'react'

// The app's icon set (docs/icon-system-guidelines.md): line-art, 24x24
// viewBox, currentColor stroke. Moved out of DashboardShell.tsx so any
// component can use it without pulling in the shell (BUG-2610-025: no
// emoji as icons - Android draws its own pictures for them, e.g. a
// calendar reading "July 17" beside a real date).

/** For an icon inline in a line of text: centred on the text, a small gap after. */
export const INLINE_ICON_STYLE: CSSProperties = {
  display: 'inline-block',
  verticalAlign: '-0.125em',
  flexShrink: 0,
}

export type IconName =
  | 'dashboard' | 'ticket' | 'message' | 'user' | 'calendar' | 'plus'
  | 'map' | 'trendUp' | 'dollarSign' | 'briefcase' | 'building' | 'music'
  | 'grid' | 'more' | 'x' | 'tag' | 'settings'
  // BUG-2610-025 - shapes for the concepts the app used to draw with emoji
  | 'pin' | 'camera' | 'users' | 'clock' | 'lock' | 'phone' | 'star'
  | 'flame' | 'trophy' | 'alert' | 'check' | 'wallet' | 'sparkle' | 'vote'

// GEN-2609-019 Phase C - exported so MobileTabBar.tsx's new role-specific
// bars can reuse the exact same icon shapes the desktop sidebar already
// uses for these same items (My Events/Create Event/Sales/etc.), instead
// of duplicating SVG paths in a second file.
//
// `style` is for an icon that sits inline in a line of text (pass
// INLINE_ICON_STYLE, which centres it on the text like an emoji did).
// Decorative by default (aria-hidden): the text beside it carries the
// meaning. `data-afa-icon` names the shape for tests.
export function Icon({ name, size = 16, style }: { name: IconName; size?: number | string; style?: CSSProperties }) {
  const common = {
    'aria-hidden': true,
    'data-afa-icon': name,
    style,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'ticket':
      return (<svg {...common}><path d="M15 5H9a2 2 0 0 0-2 2v.5a2.5 2.5 0 0 1 0 5V13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-.5a2.5 2.5 0 0 1 0-5V7a2 2 0 0 0-2-2z" /></svg>)
    case 'message':
      return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>)
    case 'user':
      return (<svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>)
    case 'calendar':
      return (<svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)
    case 'plus':
      return (<svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)
    case 'map':
      return (<svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>)
    case 'trendUp':
      return (<svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>)
    case 'dollarSign':
      return (<svg {...common}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>)
    case 'briefcase':
      return (<svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>)
    case 'building':
      return (<svg {...common}><rect x="4" y="2" width="16" height="20" /><path d="M9 22V12h6v10" /><rect x="8" y="6" width="3" height="3" /><rect x="13" y="6" width="3" height="3" /></svg>)
    case 'music':
      return (<svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>)
    case 'grid':
      return (<svg {...common}><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>)
    case 'more':
      return (<svg {...common}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>)
    case 'x':
      return (<svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
    case 'tag':
      return (<svg {...common}><path d="M12.59 2.59 20.41 10.41a2 2 0 0 1 0 2.83l-6.17 6.17a2 2 0 0 1-2.83 0L3.59 11.59A2 2 0 0 1 3 10.17V4a2 2 0 0 1 2-2h6.17a2 2 0 0 1 1.42.59Z" /><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" /></svg>)
    case 'settings':
      // Same gear shape already used by admin/page.tsx's own local
      // IconGear() component - matched for visual consistency rather
      // than inventing a new gear.
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" /></svg>)
    case 'pin':
      return (<svg {...common}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>)
    case 'camera':
      return (<svg {...common}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>)
    case 'users':
      return (<svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
    case 'clock':
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
    case 'lock':
      return (<svg {...common}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>)
    case 'phone':
      return (<svg {...common}><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></svg>)
    case 'star':
      // Filled: a rating star reads as a solid mark, like the emoji it replaces.
      return (<svg {...common} fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)
    case 'flame':
      return (<svg {...common}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>)
    case 'trophy':
      return (<svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>)
    case 'alert':
      return (<svg {...common}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>)
    case 'check':
      return (<svg {...common}><polyline points="20 6 9 17 4 12" /></svg>)
    case 'wallet':
      return (<svg {...common}><path d="M20 7H5a2 2 0 0 1 0-4h13v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15V7" /><circle cx="16" cy="14" r="1" fill="currentColor" /></svg>)
    case 'sparkle':
      return (<svg {...common}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></svg>)
    case 'vote':
      return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="8 12 11 15 16 9" /></svg>)
    default:
      return null
  }
}
