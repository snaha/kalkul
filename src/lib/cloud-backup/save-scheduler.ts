/**
 * When to write a backup after edits: once they pause for `idleMs`, but no
 * later than `maxWaitMs` after the first unsaved one, so a long editing
 * session still gets saved along the way. `flush` saves at once (the tab is
 * being left).
 */
export function createSaveScheduler(
  save: () => void,
  { idleMs, maxWaitMs }: { idleMs: number; maxWaitMs: number },
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let firstChangeAt: number | undefined

  function fire(): void {
    timer = undefined
    firstChangeAt = undefined
    save()
  }

  function cancel(): void {
    clearTimeout(timer)
    timer = undefined
    firstChangeAt = undefined
  }

  return {
    changed(): void {
      const now = Date.now()
      firstChangeAt ??= now
      clearTimeout(timer)
      timer = setTimeout(fire, Math.max(0, Math.min(idleMs, firstChangeAt + maxWaitMs - now)))
    },
    flush(): void {
      if (timer === undefined) return
      clearTimeout(timer)
      fire()
    },
    cancel,
    get pending(): boolean {
      return timer !== undefined
    },
  }
}
