import mermaid from 'mermaid'
import type { MermaidConfig } from 'mermaid'
import { svgToPngBlob } from '../utils/image'

/**
 * Mermaid rendering for document export.
 *
 * The live transcript renders diagrams lazily and inherits the active theme, so
 * scraping the DOM produces missing diagrams (never scrolled into view) and
 * light text on a white page (dark theme). Export instead renders each diagram
 * from its source with an explicit, print-safe light theme and rasterizes it.
 */

let renderCounter = 0

const EXPORT_THEME: MermaidConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  htmlLabels: false,
  fontFamily: 'Helvetica, Arial, sans-serif',
  themeVariables: {
    background: '#ffffff',
    primaryColor: '#dbeafe',
    primaryBorderColor: '#2563eb',
    primaryTextColor: '#0f172a',
    secondaryColor: '#ffedd5',
    secondaryBorderColor: '#ea580c',
    secondaryTextColor: '#7c2d12',
    tertiaryColor: '#dcfce7',
    tertiaryBorderColor: '#16a34a',
    tertiaryTextColor: '#14532d',
    lineColor: '#475569',
    textColor: '#0f172a',
    mainBkg: '#ffffff',
    nodeBorder: '#94a3b8',
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    titleColor: '#0f172a',
    edgeLabelBackground: '#ffffff',
    fontSize: '13px',
    pieTitleTextColor: '#0f172a',
    pieLegendTextColor: '#0f172a',
    pieSectionTextColor: '#ffffff',
    pieStrokeColor: '#ffffff',
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: '#cbd5e1',
    pieOpacity: '0.95',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#0f172a',
      dataLabelColor: '#0f172a',
      legendTextColor: '#0f172a',
      xAxisLabelColor: '#0f172a',
      xAxisTitleColor: '#0f172a',
      xAxisTickColor: '#475569',
      xAxisLineColor: '#94a3b8',
      yAxisLabelColor: '#0f172a',
      yAxisTitleColor: '#0f172a',
      yAxisTickColor: '#475569',
      yAxisLineColor: '#94a3b8',
    },
  },
  flowchart: {
    curve: 'basis',
    padding: 16,
    useMaxWidth: true,
    wrappingWidth: 200,
    nodeSpacing: 36,
    rankSpacing: 36,
  },
  pie: { textPosition: 0.62, useMaxWidth: true },
  xyChart: { useMaxWidth: true },
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

function mountSvg(markup: string): SVGSVGElement | null {
  const holder = document.createElement('div')
  holder.style.cssText =
    'position:absolute;left:-10000px;top:0;width:900px;height:900px;overflow:visible;background:#ffffff;'
  holder.innerHTML = markup
  const svg = holder.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) {
    holder.remove()
    return null
  }
  document.body.appendChild(holder)
  // Keep the holder alive until the caller finishes rasterizing, then remove it.
  ;(svg as SVGSVGElement & { __tabulaHolder?: HTMLElement }).__tabulaHolder = holder
  return svg
}

function releaseSvg(svg: SVGSVGElement): void {
  const holder = (svg as SVGSVGElement & { __tabulaHolder?: HTMLElement }).__tabulaHolder
  holder?.remove()
}

async function rasterize(svg: SVGSVGElement): Promise<string> {
  try {
    const blob = await svgToPngBlob(svg, 1.6)
    return await blobToDataUrl(blob)
  } catch (err) {
    console.warn('Could not rasterize Mermaid diagram for export:', err)
    return ''
  } finally {
    releaseSvg(svg)
  }
}

/**
 * Renders a batch of Mermaid sources to PNG data URLs. The Mermaid global config
 * is switched to a print-safe light theme for the batch and restored afterwards.
 * Returns an empty string for any diagram that cannot be rendered.
 */
export async function renderMermaidPngBatch(
  codes: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const results: string[] = new Array(codes.length).fill('')
  if (codes.length === 0) return results

  let previous: MermaidConfig | null = null
  try {
    previous = mermaid.mermaidAPI.getConfig()
  } catch {
    // Keep null: there is no theme to restore.
  }

  try {
    mermaid.initialize(EXPORT_THEME)

    for (let index = 0; index < codes.length; index++) {
      const source = codes[index].trim()
      if (source.length === 0) {
        onProgress?.(index + 1, codes.length)
        continue
      }

      try {
        await mermaid.parse(source)
        const id = `tabula-export-mermaid-${++renderCounter}`
        const rendered = await mermaid.render(id, source)
        const svg = mountSvg(rendered.svg)
        results[index] = svg ? await rasterize(svg) : ''
      } catch (err) {
        console.warn('Could not render Mermaid diagram for export:', err)
      }

      onProgress?.(index + 1, codes.length)
    }
  } finally {
    if (previous) {
      try {
        mermaid.initialize(previous)
      } catch {
        // If the previous config cannot be restored the diagram still exported.
      }
    }
  }

  return results
}
