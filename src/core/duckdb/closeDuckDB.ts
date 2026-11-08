import { getDuckDBHandle, hasDuckDBHandle, resetDuckDBHandle } from './initDuckDB'

export async function closeDuckDB(): Promise<void> {
  if (!hasDuckDBHandle()) {
    resetDuckDBHandle()
    return
  }

  const current = getDuckDBHandle()
  resetDuckDBHandle()

  try {
    await current.connection.close()
  } catch {
    // Connection may already be gone after a failed query.
  }

  try {
    await current.db.terminate()
  } catch {
    // The worker can already be torn down during page unload.
  }
}
