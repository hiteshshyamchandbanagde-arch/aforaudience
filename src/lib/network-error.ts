// BUG-2610-001 follow-up (14 Oct) - a request that failed because the
// device has no signal, as opposed to the server saying no. fetch rejects
// with a TypeError when there is no response at all; an HTTP error still
// resolves. Sign-in used to show "Could not send code." (or the raw
// "Failed to fetch") offline, which reads like the server's fault.
export function isOfflineFailure(err: unknown, onLine?: boolean): boolean {
  const online = onLine ?? (typeof navigator === 'undefined' ? true : navigator.onLine)
  if (online === false) return true
  return err instanceof TypeError
}
