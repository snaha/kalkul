export type LoadError = {
  /** The raw unparseable payload, kept in memory for download. */
  raw: string
  /**
   * localStorage key holding the quarantined copy of `raw`, or undefined if
   * writing the quarantine copy itself failed (e.g. quota) — the in-memory
   * `raw` is then the only surviving copy.
   */
  recoveryKey: string | undefined
}

function withLoadErrorStore() {
  let error = $state<LoadError | undefined>(undefined)

  return {
    get error() {
      return error
    },
    set(newError: LoadError) {
      error = newError
    },
    dismiss() {
      error = undefined
    },
  }
}

/**
 * Set when loadData() finds stored data it cannot parse. The recovery dialog
 * in the root layout consumes it, offering a download of the original payload
 * before the user continues with whatever could be salvaged.
 */
export const loadErrorStore = withLoadErrorStore()
