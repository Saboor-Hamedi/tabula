import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * `React.lazy` with a single automatic retry.
 *
 * Vite serves every dynamic import as its own module request. On a cold dev
 * server the first request for a chunk can come back empty while the
 * dependency graph is still being optimized, which surfaces as
 * "Failed to fetch dynamically imported module". The chunk is there a moment
 * later, so one retry fixes it without a page reload.
 *
 * The same guard covers a production deploy where a hashed chunk name moved
 * between the HTML and the asset manifest.
 */
export function lazyWithRetry<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  retries = 1,
  delayMs = 250,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await factory()
      } catch (error) {
        lastError = error
        console.warn(
          `Lazy import failed (attempt ${attempt + 1} of ${retries + 1}). Retrying…`,
          error,
        )
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    throw lastError
  })
}
