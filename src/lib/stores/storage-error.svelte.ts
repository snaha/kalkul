// 'write' — localStorage.setItem threw (quota exceeded, private mode, …).
// 'validation' — persist() refused to write data the read path would reject
// (a bug upstream of persist; writing it would brick the dataset on reload).
export type StorageErrorKind = 'write' | 'validation'

function withStorageErrorStore() {
  let kind = $state<StorageErrorKind | undefined>(undefined)

  return {
    get hasError() {
      return kind !== undefined
    },
    get kind() {
      return kind
    },
    setError(newKind: StorageErrorKind = 'write') {
      kind = newKind
    },
    clear() {
      kind = undefined
    },
  }
}

export const storageErrorStore = withStorageErrorStore()
