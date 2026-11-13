import { useEffect, useRef } from 'react'

interface PixelNode {
  bx: number
  by: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

/**
 * Lightweight, GPU-friendly cursor-reactive pixel field for hero sections.
 * Automatically sleeps when pixels settle so idle CPU/GPU usage is zero.
 */
export function HeroPixelField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1
    let nodes: PixelNode[] = []
    let rafId = 0
    let running = false
    const pointer = { x: -9999, y: -9999, active: false }

    const readColors = () => {
      const style = getComputedStyle(document.documentElement)
      const accent = style.getPropertyValue('--accent').trim() || '#0f766e'
      const text = style.getPropertyValue('--text').trim() || '#0f172a'
      return { accent, text }
    }

    let colors = readColors()

    const buildGrid = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const step = width < 640 ? 34 : 38
      const cols = Math.ceil(width / step) + 1
      const rows = Math.ceil(height / step) + 1
      const offsetX = (width - (cols - 1) * step) * 0.5
      const offsetY = (height - (rows - 1) * step) * 0.5

      nodes = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = offsetX + c * step
          const by = offsetY + r * step
          nodes.push({
            bx,
            by,
            x: bx,
            y: by,
            vx: 0,
            vy: 0,
            size: (r + c) % 3 === 0 ? 3 : 2,
            alpha: 0.14 + ((r * 7 + c * 13) % 5) * 0.025,
          })
        }
      }
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height)
      const radius = 150
      const radiusSq = radius * radius
      let moving = false

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        let highlight = 0

        if (pointer.active && !reducedMotion) {
          const dx = pointer.x - n.x
          const dy = pointer.y - n.y
          const distSq = dx * dx + dy * dy
          if (distSq < radiusSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq)
            const force = (1 - dist / radius) * 0.85
            highlight = 1 - dist / radius
            // Gently pull & swirl pixels along the cursor
            n.vx += (dx / dist) * force * 1.15
            n.vy += (dy / dist) * force * 1.15
          }
        }

        // Spring back to home coordinate
        n.vx += (n.bx - n.x) * 0.08
        n.vy += (n.by - n.y) * 0.08
        n.vx *= 0.82
        n.vy *= 0.82
        n.x += n.vx
        n.y += n.vy

        if (
          Math.abs(n.vx) > 0.02 ||
          Math.abs(n.vy) > 0.02 ||
          Math.abs(n.x - n.bx) > 0.05 ||
          Math.abs(n.y - n.by) > 0.05
        ) {
          moving = true
        }

        const sz = n.size + highlight * 2.2
        ctx.globalAlpha = Math.min(0.9, n.alpha + highlight * 0.6)
        ctx.fillStyle = highlight > 0.12 ? colors.accent : colors.text
        ctx.fillRect(Math.round(n.x - sz * 0.5), Math.round(n.y - sz * 0.5), sz, sz)
      }

      ctx.globalAlpha = 1

      if (pointer.active || moving) {
        rafId = window.requestAnimationFrame(drawFrame)
      } else {
        running = false
      }
    }

    const startLoop = () => {
      if (running) return
      running = true
      rafId = window.requestAnimationFrame(drawFrame)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = true
      startLoop()
    }

    const onPointerLeave = () => {
      pointer.active = false
      startLoop()
    }

    const onThemeChange = () => {
      colors = readColors()
      drawFrame()
    }

    buildGrid()
    drawFrame()

    const resizeObserver = new ResizeObserver(() => {
      buildGrid()
      drawFrame()
    })
    resizeObserver.observe(host)

    const themeObserver = new MutationObserver(onThemeChange)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })

    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave, { passive: true })

    return () => {
      window.cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="hero-pixel-canvas" aria-hidden="true" />
}
