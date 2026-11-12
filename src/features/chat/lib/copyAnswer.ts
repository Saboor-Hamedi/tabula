function svgToPngDataUrl(svg: SVGSVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const rect = svg.getBoundingClientRect()
      const viewBox = svg.viewBox?.baseVal
      const width = Math.max(
        1,
        Math.round(rect.width || (viewBox && viewBox.width > 0 ? viewBox.width : 600)),
      )
      const height = Math.max(
        1,
        Math.round(rect.height || (viewBox && viewBox.height > 0 ? viewBox.height : 320)),
      )

      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      clone.setAttribute('width', String(width))
      clone.setAttribute('height', String(height))

      const serialized = new XMLSerializer().serializeToString(clone)
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
      const img = new Image()

      img.onload = () => {
        try {
          const scale = 2
          const canvas = document.createElement('canvas')
          canvas.width = width * scale
          canvas.height = height * scale
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          const isDark = document.documentElement.dataset.theme === 'dark'
          ctx.fillStyle = isDark ? '#18181b' : '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.scale(scale, scale)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = svgUrl
    } catch {
      resolve(null)
    }
  })
}

/**
 * Copies an assistant answer to the clipboard as both formatted HTML (with
 * rendered Mermaid/chart diagrams embedded as PNG images alongside text and
 * code blocks) and plain Markdown text.
 */
export async function copyRichAnswer(
  container: HTMLElement | null,
  markdown: string,
): Promise<void> {
  if (
    container &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    try {
      const clone = container.cloneNode(true) as HTMLElement
      for (const el of clone.querySelectorAll('button, .figure-toolbar, .mermaid-controls')) {
        el.remove()
      }

      const liveSvgs = Array.from(container.querySelectorAll('svg'))
      const clonedSvgs = Array.from(clone.querySelectorAll('svg'))

      await Promise.all(
        liveSvgs.map(async (liveSvg, index) => {
          const clonedSvg = clonedSvgs[index]
          if (!clonedSvg) return
          const rect = liveSvg.getBoundingClientRect()
          if (rect.width < 24 || rect.height < 24) return
          const pngUrl = await svgToPngDataUrl(liveSvg)
          if (!pngUrl) return

          const img = document.createElement('img')
          img.src = pngUrl
          img.width = Math.round(rect.width)
          img.height = Math.round(rect.height)
          img.alt = 'Diagram'
          img.style.maxWidth = '100%'
          img.style.height = 'auto'
          img.style.display = 'block'
          img.style.margin = '12px 0'
          clonedSvg.replaceWith(img)
        }),
      )

      const html = `<div>${clone.innerHTML}</div>`
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([markdown], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // Fall back to plain text copy if rich clipboard write is blocked.
    }
  }

  await navigator.clipboard.writeText(markdown)
}
