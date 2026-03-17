function withStorageErrorStore() {
  let hasError = $state(false)

  return {
    get hasError() {
      return hasError
    },
    set() {
      hasError = true
    },
    clear() {
      hasError = false
    },
  }
}

export const storageErrorStore = withStorageErrorStore()
