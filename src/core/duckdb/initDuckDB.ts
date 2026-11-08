import * as duckdb from '@duckdb/duckdb-wasm'
import duckdbMvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdbEhWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import mvpWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import ehWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

export interface DuckDBHandle {
  db: duckdb.AsyncDuckDB
  connection: duckdb.AsyncDuckDBConnection
}

const bundles: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbMvpWasm,
    mainWorker: mvpWorkerUrl,
  },
  eh: {
    mainModule: duckdbEhWasm,
    mainWorker: ehWorkerUrl,
  },
}

let handlePromise: Promise<DuckDBHandle> | null = null
let handle: DuckDBHandle | null = null

async function createHandle(): Promise<DuckDBHandle> {
  const bundle = await duckdb.selectBundle(bundles)
  if (!bundle.mainWorker) {
    throw new Error('DuckDB could not locate a browser worker bundle.')
  }

  const worker = new Worker(bundle.mainWorker)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)

  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    const connection = await db.connect()
    const created: DuckDBHandle = { db, connection }
    handle = created
    return created
  } catch (error) {
    try {
      await db.terminate()
    } catch {
      // Ignore teardown failures while surfacing the original error.
    }
    throw error
  }
}

export function initDuckDB(): Promise<DuckDBHandle> {
  if (handle) return Promise.resolve(handle)
  if (!handlePromise) {
    handlePromise = createHandle().catch((error: unknown) => {
      handlePromise = null
      handle = null
      throw error
    })
  }
  return handlePromise
}

export function getDuckDBHandle(): DuckDBHandle {
  if (!handle) {
    throw new Error('DuckDB is not initialized yet.')
  }
  return handle
}

export function hasDuckDBHandle(): boolean {
  return handle !== null
}

export function resetDuckDBHandle(): void {
  handle = null
  handlePromise = null
}
