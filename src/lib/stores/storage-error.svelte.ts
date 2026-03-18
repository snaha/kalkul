function withStorageErrorStore() {
  let hasError = $state(false)

  return {
    get hasError() {
      return hasError
    },
    setError() {
      hasError = true
    },
    clear() {
      hasError = false
    },
  }
}

export const storageErrorStore = withStorageErrorStore()
