// Fixed mobile chrome heights shared by everything that floats above the
// bottom tab bar (the support chat button, toasts). One place, so the
// chat button and a toast can't drift into each other if the bar changes.
// Mirrors `body.afa-mobile-tab-bar-active` in globals.css; applies below
// the same 1023px breakpoint the tab bar renders at (`lg:hidden`).
export const MOBILE_BREAKPOINT_MAX = 1023
export const MOBILE_TAB_BAR_HEIGHT = 'calc(64px + env(safe-area-inset-bottom))'
export const CHAT_BUTTON_SIZE = 56
export const CHAT_BUTTON_MOBILE_BOTTOM = `calc(${MOBILE_TAB_BAR_HEIGHT} + 8px)`
// Top of the chat button, plus the same 12px gap the chat panel keeps.
export const ABOVE_CHAT_BUTTON_MOBILE = `calc(${CHAT_BUTTON_MOBILE_BOTTOM} + ${CHAT_BUTTON_SIZE}px + 12px)`
