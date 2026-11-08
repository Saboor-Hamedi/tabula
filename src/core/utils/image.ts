/**
 * Image export helpers for charts and figures.
 *
 * A rendered Mermaid chart is an <svg>. To let the user copy it as an image we
 * serialize the SVG, paint it onto a canvas at 2x, and hand the PNG to the
 * clipboard. When the clipboard API is unavailable (or the browser refuses an
 * image write) the same PNG is downloaded instead, so the action never dead-ends.
 */

/** Reads a CSS custom property, with a hard fallback for SSR/first paint. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

/** Rasterizes an SVG element to a PNG blob at the given scale. */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const bounds = svg.getBoundingClientRect()
  const viewBox = svg.viewBox?.baseVal
  const width = Math.max(1, Math.round(viewBox?.width || bounds.width || 960))
  const height = Math.max(1, Math.round(viewBox?.height || bounds.height || 540))

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.maxWidth = 'none'
  clone.style.background = 'transparent'

  const markup = new XMLSerializer().serializeToString(clone)
  const source = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not render the chart image.'))
      element.src = source
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')

    // Paint the app surface behind the chart so the PNG is not transparent.
    context.fillStyle = cssVar('--surface', '#ffffff')
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(scale, scale)
    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not export the chart image.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(source)
  }
}

/** Triggers a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export type ImageExportMode = 'copied' | 'downloaded'

/**
 * Copies the chart inside `container` to the clipboard as a PNG.
 * Falls back to a download when the clipboard cannot take an image.
 */
export async function copyFigureImage(
  container: HTMLElement,
  fileName: string,
): Promise<ImageExportMode> {
  const svg = container.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('The chart is not ready yet.')
  }

  const blob = await svgToPngBlob(svg)

  const canWrite = Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined'
  if (canWrite) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied'
    } catch {
      // Permission denied or unsupported type: fall through to download.
    }
  }

  downloadBlob(blob, fileName)
  return 'downloaded'
}

/** Downloads the chart inside `container` as a PNG. */
export async function downloadFigureImage(
  container: HTMLElement,
  fileName: string,
): Promise<void> {
  const svg = container.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('The chart is not ready yet.')
  }
  downloadBlob(await svgToPngBlob(svg), fileName)
}
