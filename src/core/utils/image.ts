/**
 * Image export helpers for charts and figures.
 *
 * A rendered Mermaid chart is an <svg>. To let the user copy it as an image we
 * serialize the SVG, paint it onto a canvas at 2x, and hand the PNG to the
 * clipboard. When the clipboard API is unavailable (or the browser refuses an
 * image write) the same PNG is downloaded instead, so the action never dead-ends.
 */

/** True when a hex color is too light to read on a transparent/white page. */
function isLightColor(color: string): boolean {
  const match = /^#([0-9a-f]{3,8})$/i.exec(color.trim())
  if (!match) return false
  const hex = match[1]
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => part + part)
          .join('')
      : hex.slice(0, 6)
  if (full.length < 6) return false
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.62
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
  // Exported figures must be transparent for Word/Google Docs. Mermaid can put
  // a theme background on the root SVG or an xychart background rect, so both
  // are neutralized before rasterizing.
  clone.style.setProperty('background', 'transparent', 'important')
  clone.style.setProperty('background-color', 'transparent', 'important')
  clone.querySelectorAll('rect.background').forEach((rect) => rect.remove())

  // Export is transparent, so light-theme/dark-theme title colors can disappear
  // on a white Word page. The agent can request one explicit color with the
  // `data-export-text-color` marker; otherwise every chart label uses dark ink.
  const marker =
    svg.getAttribute('data-export-text-color') ??
    svg.closest('[data-export-text-color]')?.getAttribute('data-export-text-color')
  // Honor a deliberate dark custom color, but never export white/near-white
  // labels onto a transparent PNG that will usually sit on a white document.
  const textColor =
    marker && /^#[0-9a-fA-F]{3,8}$/.test(marker) && !isLightColor(marker)
      ? marker
      : '#111827'

  const exportStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  exportStyle.textContent =
    'svg{background:transparent!important;background-color:transparent!important}' +
    'rect.background{display:none!important}' +
    `.chart-title text,.bottom-axis text,.left-axis text,.pieTitleText,.legend text,.elbow-chart-text{fill:${textColor}!important}` +
    `.chart-title text,.pieTitleText{font-weight:700!important}`
  clone.insertBefore(exportStyle, clone.firstChild)

  // CSS in a detached SVG can be inconsistent across browsers. Apply the export
  // color directly to every chart-label node so a copied PNG never inherits the
  // dark-theme white text.
  clone
    .querySelectorAll(
      '.chart-title text,.bottom-axis text,.left-axis text,.pieTitleText,.legend text,.elbow-chart-text',
    )
    .forEach((node) => {
      if (!(node instanceof SVGElement)) return
      node.setAttribute('fill', textColor)
      node.style.setProperty('fill', textColor, 'important')
    })

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

    // Leave the canvas untouched: its default pixels are fully transparent, so
    // the PNG pastes cleanly into Word instead of carrying a dark background.
    context.clearRect(0, 0, canvas.width, canvas.height)
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
