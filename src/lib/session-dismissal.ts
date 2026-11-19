// A notice the user closed stays closed for the browser session, and only for
// the state it was closed in: once that state moves on (newer financial data,
// a later snapshot date) the notice is back.

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>

export function isDismissed(
  key: string,
  state: string,
  storage: SessionStore = sessionStorage,
): boolean {
  return storage.getItem(key) === state
}

export function dismiss(key: string, state: string, storage: SessionStore = sessionStorage): void {
  storage.setItem(key, state)
}
