import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadMetrics() {
  vi.resetModules()
  return import('./metrics')
}

describe('metrics', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('starts empty', async () => {
    const { getMetrics } = await loadMetrics()
    expect(getMetrics()).toEqual({})
  })

  it('records rounded values', async () => {
    const { recordMetric, getMetrics } = await loadMetrics()
    recordMetric('lastUploadMs', 1234.6)
    expect(getMetrics().lastUploadMs).toBe(1235)
  })

  it('ignores negative and non-finite values', async () => {
    const { recordMetric, getMetrics } = await loadMetrics()
    recordMetric('a', -1)
    recordMetric('b', Number.NaN)
    recordMetric('c', Number.POSITIVE_INFINITY)
    expect(getMetrics()).toEqual({})
  })

  it('overwrites an existing metric with the latest value', async () => {
    const { recordMetric, getMetrics } = await loadMetrics()
    recordMetric('x', 10)
    recordMetric('x', 20)
    expect(getMetrics().x).toBe(20)
  })
})
