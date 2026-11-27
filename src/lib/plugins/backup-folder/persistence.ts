import type { SyncState } from './sync-engine'

/**
 * Backup-folder state shared by every tab of this origin, in IndexedDB rather
 * than localStorage: IndexedDB transactions are consistent across tabs (a
 * tab that takes the sync lock after another released it reads what that tab
 * wrote), and it can hold what localStorage cannot — the folder handle.
 */

export interface Connection {
  /** This computer's name in every file it writes (`deviceName`). */
  device: string
  /** The folder's name, for display. */
  folder: string
}

interface Records {
  connection: Connection
  directory: FileSystemDirectoryHandle
  sync: SyncState
}

const DB_NAME = 'kalkul-backup-folder'
const STORE = 'kv'

let opening: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = undefined
      reject(request.error ?? new Error('Could not open IndexedDB'))
    }
  })
  return opening
}

async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = operation(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function load<K extends keyof Records>(key: K): Promise<Records[K] | undefined> {
  return (await run('readonly', (store) => store.get(key))) as Records[K] | undefined
}

export async function save<K extends keyof Records>(key: K, value: Records[K]): Promise<void> {
  await run('readwrite', (store) => store.put(value, key))
}

export async function remove(key: keyof Records): Promise<void> {
  await run('readwrite', (store) => store.delete(key))
}

/** Forgets the connection entirely (disconnect). */
export async function clearAll(): Promise<void> {
  await run('readwrite', (store) => store.clear())
}
