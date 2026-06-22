import { beforeNavigate, goto } from '$app/navigation'

/**
 * Shared guard that warns before abandoning a multi-step flow (onboarding,
 * add-plan) with unsaved changes.
 *
 * Navigation between steps and the flow's own programmatic navigation use
 * `goto()` (navigation type `'goto'`), which is never intercepted — those are
 * handled by per-step snapshots and explicit saves. Only `'link'` clicks (the
 * header X) and `'popstate'` (browser back/forward) that leave the flow are
 * intercepted, and only while the active flow reports unsaved changes.
 */
class LeaveGuard {
  /** The destination awaiting confirmation; `undefined` means the dialog is closed. */
  pendingUrl = $state<URL | undefined>(undefined)

  /** Live check for whether the active flow has unsaved changes. */
  #isDirty: () => boolean = () => false

  get open(): boolean {
    return this.pendingUrl !== undefined
  }

  /** Register the dirty-check for the currently mounted flow. */
  setDirtyCheck(check: () => boolean): void {
    this.#isDirty = check
  }

  /**
   * Install the navigation guard for a flow whose routes share `flowGroupId`
   * (e.g. `'(onboarding)'`). Call once during the flow layout's initialisation.
   */
  guard(flowGroupId: string): void {
    beforeNavigate((navigation) => {
      // Only intercept user-driven exits: the header X (link) and browser
      // back/forward (popstate). The flow's own goto()-based navigation passes.
      if (navigation.type !== 'link' && navigation.type !== 'popstate') return
      if (!this.#isDirty()) return
      const toId = navigation.to?.route.id
      // Staying inside the flow (another step) is safe — snapshots preserve it.
      if (!navigation.to || toId?.includes(flowGroupId)) return
      navigation.cancel()
      this.pendingUrl = navigation.to.url
    })
  }

  /** Proceed to the pending destination, discarding unsaved changes. */
  confirm(): void {
    const url = this.pendingUrl
    this.pendingUrl = undefined
    // `url` is the already-resolved destination captured from `navigation.to.url`.
    // goto() is navigation type 'goto', so it is not re-intercepted by the guard.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    if (url) goto(url)
  }

  /** Keep the user on the current page. */
  dismiss(): void {
    this.pendingUrl = undefined
  }
}

export const leaveGuard = new LeaveGuard()
