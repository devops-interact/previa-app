'use client'

import { useEffect, useRef } from 'react'

interface Shape {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    rotation: number
    rotationSpeed: number
    type: 'triangle' | 'hexagon' | 'circle' | 'diamond'
    opacity: number
    color: string
    pulsePhase: number
    pulseSpeed: number
}

const COLORS = [
    'rgba(59, 130, 246, ',   // blue-500
    'rgba(96, 165, 250, ',   // blue-400
    'rgba(37, 99, 235, ',    // blue-600
    'rgba(147, 197, 253, ',  // blue-300
    'rgba(30, 64, 175, ',    // blue-800
]

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
        const angle = rotation + (i * Math.PI * 2) / 3 - Math.PI / 2
        const px = x + Math.cos(angle) * size
        const py = y + Math.sin(angle) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
    }
    ctx.closePath()
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
        const angle = rotation + (i * Math.PI * 2) / 6
        const px = x + Math.cos(angle) * size
        const py = y + Math.sin(angle) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
    }
    ctx.closePath()
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
        const angle = rotation + (i * Math.PI * 2) / 4
        const px = x + Math.cos(angle) * size
        const py = y + Math.sin(angle) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
    }
    ctx.closePath()
}

export function GeometricBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const mouseRef = useRef({ x: 0, y: 0 })
    const shapesRef = useRef<Shape[]>([])
    const animRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        const handleMouse = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener('mousemove', handleMouse)

        const types: Shape['type'][] = ['triangle', 'hexagon', 'circle', 'diamond']
        const shapes: Shape[] = []
        const count = Math.min(35, Math.floor(window.innerWidth / 40))

        for (let i = 0; i < count; i++) {
            shapes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: 8 + Math.random() * 28,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.008,
                type: types[Math.floor(Math.random() * types.length)],
                opacity: 0.03 + Math.random() * 0.08,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                pulsePhase: Math.random() * Math.PI * 2,
                pulseSpeed: 0.005 + Math.random() * 0.01,
            })
        }
        shapesRef.current = shapes

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const mx = mouseRef.current.x
            const my = mouseRef.current.y

            for (const s of shapes) {
                // Mouse parallax influence
                const dx = mx - s.x
                const dy = my - s.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                const influence = Math.max(0, 1 - dist / 400)
                const pushX = dx * influence * 0.003
                const pushY = dy * influence * 0.003

                s.x += s.vx + pushX
                s.y += s.vy + pushY
                s.rotation += s.rotationSpeed

                // Pulse opacity
                s.pulsePhase += s.pulseSpeed
                const pulse = Math.sin(s.pulsePhase) * 0.03

                // Wrap around edges
                if (s.x < -50) s.x = canvas.width + 50
                if (s.x > canvas.width + 50) s.x = -50
                if (s.y < -50) s.y = canvas.height + 50
                if (s.y > canvas.height + 50) s.y = -50

                const finalOpacity = Math.max(0.01, s.opacity + pulse + influence * 0.06)

                // Draw shape
                ctx.save()
                ctx.strokeStyle = s.color + finalOpacity + ')'
                ctx.fillStyle = s.color + (finalOpacity * 0.3) + ')'
                ctx.lineWidth = 1

                if (s.type === 'circle') {
                    ctx.beginPath()
                    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.stroke()
                } else if (s.type === 'triangle') {
                    drawTriangle(ctx, s.x, s.y, s.size, s.rotation)
                    ctx.fill()
                    ctx.stroke()
                } else if (s.type === 'hexagon') {
                    drawHexagon(ctx, s.x, s.y, s.size, s.rotation)
                    ctx.fill()
                    ctx.stroke()
                } else if (s.type === 'diamond') {
                    drawDiamond(ctx, s.x, s.y, s.size, s.rotation)
                    ctx.fill()
                    ctx.stroke()
                }

                ctx.restore()
            }

            // Draw faint connecting lines between nearby shapes
            ctx.save()
            for (let i = 0; i < shapes.length; i++) {
                for (let j = i + 1; j < shapes.length; j++) {
                    const a = shapes[i]
                    const b = shapes[j]
                    const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
                    if (d < 180) {
                        const lineOpacity = (1 - d / 180) * 0.06
                        ctx.strokeStyle = `rgba(59, 130, 246, ${lineOpacity})`
                        ctx.lineWidth = 0.5
                        ctx.beginPath()
                        ctx.moveTo(a.x, a.y)
                        ctx.lineTo(b.x, b.y)
                        ctx.stroke()
                    }
                }
            }
            ctx.restore()

            animRef.current = requestAnimationFrame(animate)
        }
        animate()

        return () => {
            cancelAnimationFrame(animRef.current)
            window.removeEventListener('resize', resize)
            window.removeEventListener('mousemove', handleMouse)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
        />
    )
}
