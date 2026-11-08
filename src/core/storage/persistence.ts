import type { ChatMessage, Session, ToolTraceEntry } from '../types'

const DB_NAME = 'tabula-workspace'
const DB_VERSION = 1
const SESSION_STORE = 'sessions'
const FILE_STORE = 'files'
const META_STORE = 'meta'
const ACTIVE_SESSION_KEY = 'active-session-id'

/** A complete, serializable snapshot of one dataset session. */
export interface PersistedSessionRecord {
  id: string
  session: Session
  messages: ChatMessage[]
  traces: ToolTraceEntry[]
  updatedAt: number
}

/** Shape returned when the app starts and asks for its previous workspace. */
export interface PersistedWorkspace {
  sessions: PersistedSessionRecord[]
  activeSessionId: string | null
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

/** Opens (and upgrades) the small IndexedDB database used for workspace recovery. */
function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        database.createObjectStore(FILE_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return databasePromise
}

/** Loads every session snapshot and the previously selected session. */
export async function loadPersistedWorkspace(): Promise<PersistedWorkspace> {
  const database = await openDatabase()
  if (!database) return { sessions: [], activeSessionId: null }

  try {
    const transaction = database.transaction([SESSION_STORE, META_STORE], 'readonly')
    const sessionsRequest = transaction.objectStore(SESSION_STORE).getAll()
    const activeRequest = transaction.objectStore(META_STORE).get(ACTIVE_SESSION_KEY)
    const [records, active] = await Promise.all([
      requestToPromise(sessionsRequest) as Promise<PersistedSessionRecord[]>,
      requestToPromise(activeRequest) as Promise<{ key: string; value: string } | undefined>,
    ])
    await transactionDone(transaction)

    const sorted = records
      .filter((record) => record?.session?.id)
      .sort((left, right) => right.session.uploadedAt - left.session.uploadedAt)

    return {
      sessions: sorted,
      activeSessionId:
        active && sorted.some((record) => record.session.id === active.value)
          ? active.value
          : (sorted[0]?.session.id ?? null),
    }
  } catch {
    return { sessions: [], activeSessionId: null }
  }
}

/** Persists a session snapshot after uploads, answers, or trace updates. */
export async function savePersistedSession(record: PersistedSessionRecord): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  try {
    const transaction = database.transaction(SESSION_STORE, 'readwrite')
    transaction.objectStore(SESSION_STORE).put({ ...record, updatedAt: Date.now() })
    await transactionDone(transaction)
  } catch {
    // Persistence is best-effort: the app must keep working in private browsing modes.
  }
}

/** Stores the original file so it can be reopened without asking for it again. */
export async function saveSessionFile(sessionId: string, file: File): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  try {
    const transaction = database.transaction(FILE_STORE, 'readwrite')
    transaction.objectStore(FILE_STORE).put({
      id: sessionId,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      savedAt: Date.now(),
    })
    await transactionDone(transaction)
  } catch {
    // Ignore storage quota failures. The session still works for this tab.
  }
}

/** Restores the original file as a browser File object. */
export async function loadSessionFile(sessionId: string): Promise<File | null> {
  const database = await openDatabase()
  if (!database) return null

  try {
    const transaction = database.transaction(FILE_STORE, 'readonly')
    const record = (await requestToPromise(
      transaction.objectStore(FILE_STORE).get(sessionId),
    )) as { name?: string; type?: string; blob?: Blob } | undefined
    await transactionDone(transaction)

    if (!record?.blob) return null
    return new File([record.blob], record.name ?? 'dataset', {
      type: record.type ?? 'application/octet-stream',
    })
  } catch {
    return null
  }
}

/** Removes a session snapshot and its stored file in one transaction. */
export async function deletePersistedSession(sessionId: string): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  try {
    const transaction = database.transaction([SESSION_STORE, FILE_STORE], 'readwrite')
    transaction.objectStore(SESSION_STORE).delete(sessionId)
    transaction.objectStore(FILE_STORE).delete(sessionId)
    await transactionDone(transaction)
  } catch {
    // Deleting from the in-memory app remains the source of truth for this tab.
  }
}

/** Remembers which session should reopen after a refresh. */
export async function saveActiveSessionId(sessionId: string | null): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  try {
    const transaction = database.transaction(META_STORE, 'readwrite')
    const store = transaction.objectStore(META_STORE)
    if (sessionId) {
      store.put({ key: ACTIVE_SESSION_KEY, value: sessionId })
    } else {
      store.delete(ACTIVE_SESSION_KEY)
    }
    await transactionDone(transaction)
  } catch {
    // Active-session persistence is optional.
  }
}

/** Clears every stored row. Used when the final session is deleted. */
export async function clearPersistedWorkspace(): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  try {
    const transaction = database.transaction(
      [SESSION_STORE, FILE_STORE, META_STORE],
      'readwrite',
    )
    transaction.objectStore(SESSION_STORE).clear()
    transaction.objectStore(FILE_STORE).clear()
    transaction.objectStore(META_STORE).clear()
    await transactionDone(transaction)
  } catch {
    // Ignore cleanup failures.
  }
}
