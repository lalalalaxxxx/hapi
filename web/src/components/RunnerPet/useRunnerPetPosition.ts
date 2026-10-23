import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { placeRunnerPet, type PetPoint, type PetRect } from './position'

const KEY = 'hapi-runner-pet-position'
function readAnchor(): PetPoint | null {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PetPoint | null
        return value && Number.isFinite(value.x) && Number.isFinite(value.y)
            && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1 ? value : null
    } catch { return null }
}
function viewport(): PetRect {
    const visual = window.visualViewport
    return { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
        width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight }
}

export function useRunnerPetPosition() {
    const anchor = useRef(readAnchor())
    const drag = useRef<{ id: number; start: PetPoint; origin: PetPoint; moved: boolean } | null>(null)
    const suppressClick = useRef(false)
    const [dragging, setDragging] = useState(false)
    const [placement, setPlacement] = useState({ x: 0, y: 0, width: 96, height: 144, visible: false })
    const current = useRef(placement)
    const [bottomPadding, setBottomPadding] = useState(8)
    const recalculate = useCallback((point?: PetPoint) => {
        const view = viewport()
        const width = view.width < 920 ? 80 : 96
        const height = width * 1.5
        const preferred = anchor.current ?? { x: view.width < 920 ? 1 : 0, y: 1 }
        const desired = point ?? { x: view.left + preferred.x * Math.max(0, view.width - width),
            y: view.top + preferred.y * Math.max(0, view.height - height) }
        const obstacles = [...document.querySelectorAll<HTMLElement>('[data-runner-pet-avoid]')]
            .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height)
        const next = placeRunnerPet(desired, { width, height }, view, obstacles)
        current.current = next
        setPlacement(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next)
        const floor = Math.min(view.top + view.height, ...obstacles.map(rect => rect.top))
        setBottomPadding(Math.max(8, window.innerHeight - floor + 8))
        return next
    }, [])

    useLayoutEffect(() => {
        let frame = 0
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => recalculate()) }
        const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
        const bind = () => {
            resize?.disconnect()
            document.querySelectorAll('[data-runner-pet-avoid]').forEach(node => resize?.observe(node))
            schedule()
        }
        const mutation = new MutationObserver(bind)
        mutation.observe(document.body, { childList: true, subtree: true })
        bind()
        recalculate()
        window.addEventListener('resize', schedule)
        document.addEventListener('scroll', schedule, true)
        window.visualViewport?.addEventListener('resize', schedule)
        window.visualViewport?.addEventListener('scroll', schedule)
        return () => {
            cancelAnimationFrame(frame)
            resize?.disconnect(); mutation.disconnect()
            window.removeEventListener('resize', schedule)
            document.removeEventListener('scroll', schedule, true)
            window.visualViewport?.removeEventListener('resize', schedule)
            window.visualViewport?.removeEventListener('scroll', schedule)
        }
    }, [recalculate])

    const move = (point: PetPoint) => {
        const next = recalculate(point)
        const view = viewport()
        anchor.current = { x: Math.max(0, Math.min(1, (next.x - view.left) / Math.max(1, view.width - next.width))),
            y: Math.max(0, Math.min(1, (next.y - view.top) / Math.max(1, view.height - next.height))) }
    }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(anchor.current)) } catch { /* Memory-only in private mode. */ } }
    const end = (event: PointerEvent<HTMLButtonElement>) => {
        if (drag.current?.id !== event.pointerId) return
        suppressClick.current = drag.current.moved
        if (drag.current.moved) save()
        drag.current = null
        setDragging(false)
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }
    return {
        dragging,
        style: { left: placement.x, top: placement.y, width: placement.width, height: placement.height,
            visibility: placement.visible ? 'visible' : 'hidden' } as CSSProperties,
        collisionPadding: { top: 8, left: 8, right: 8, bottom: bottomPadding },
        handlers: {
            onPointerDown(event: PointerEvent<HTMLButtonElement>) {
                if (event.button !== 0 || event.isPrimary === false) return
                suppressClick.current = false
                drag.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY },
                    origin: { x: current.current.x, y: current.current.y }, moved: false }
                event.currentTarget.setPointerCapture?.(event.pointerId)
            },
            onPointerMove(event: PointerEvent<HTMLButtonElement>) {
                const pending = drag.current
                if (!pending || pending.id !== event.pointerId) return
                const dx = event.clientX - pending.start.x, dy = event.clientY - pending.start.y
                if (!pending.moved && Math.hypot(dx, dy) < 6) return
                if (!pending.moved) { pending.moved = true; setDragging(true) }
                move({ x: pending.origin.x + dx, y: pending.origin.y + dy })
                event.preventDefault()
            },
            onPointerUp: end,
            onPointerCancel: end,
            onLostPointerCapture: end,
            onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
                const direction: Record<string, PetPoint> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } }
                const delta = direction[event.key]
                if (!delta) return
                event.preventDefault()
                move({ x: current.current.x + delta.x, y: current.current.y + delta.y }); save()
            },
        },
        consumeDragClick(event: MouseEvent<HTMLButtonElement>) {
            if (!suppressClick.current || event.detail === 0) return false
            suppressClick.current = false
            event.preventDefault()
            return true
        },
    }
}
