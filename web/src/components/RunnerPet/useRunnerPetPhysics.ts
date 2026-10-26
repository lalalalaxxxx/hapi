import { useEffect, useRef, useState } from 'react'
import type { PetPoint } from './position'
import { isPetPointSafe, pointOnPetRoute, type PetPlacement, type PetRoute } from './roaming'
import { choosePlatformRoute, crossedSurface, hasFooting, nearestSupport, standingPoint, stepPetFall, type PetSurface, type PetVelocity } from './physics'
import { readPetWorld } from './petWorld'
import { RUNNER_PET_ANIMATIONS } from './animations'

export function useRunnerPetPhysics(options: {
    enabled: boolean
    pet: string
    hovered: boolean
    getPlacement: () => PetPlacement
    moveTo: (point: PetPoint) => PetPlacement
}) {
    const current = useRef(options)
    current.current = options
    const [motion, setMotion] = useState<'walk' | 'jump' | 'fall' | 'land' | null>(null)
    const [facingLeft, setFacingLeft] = useState(false)
    const [supportId, setSupportId] = useState<string | null>(null)
    const [poof, setPoof] = useState(0)
    useEffect(() => {
        setMotion(null); setSupportId(null)
        if (!options.enabled) return
        let disposed = false, frame = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        let support: PetSurface | null = null
        let route: PetRoute | null = null
        let velocity: PetVelocity | null = null
        let began = 0, last = performance.now(), landUntil = 0
        let nextAction = last + 5000 + Math.random() * 5000
        let initial = true, recovering = false
        let cachedWorld: ReturnType<typeof readPetWorld> | null = null
        let worldAt = -Infinity, measuredSize = ''
        const queue = (delay = 0) => {
            clearTimeout(timer); cancelAnimationFrame(frame)
            if (disposed) return
            if (delay) timer = setTimeout(() => { frame = requestAnimationFrame(tick) }, delay)
            else frame = requestAnimationFrame(tick)
        }
        const attach = (surface: PetSurface, landing: boolean, now: number) => {
            support = surface; route = null; velocity = null
            setSupportId(surface.id)
            landUntil = landing ? now + RUNNER_PET_ANIMATIONS.land.duration : 0
            setMotion(landing ? 'land' : null)
            nextAction = now + 5000 + Math.random() * 5000
            if (recovering && surface.kind === 'floor') setPoof(value => value + 1)
            recovering = false
        }
        const fall = (vx = 0) => {
            support = null; route = null; velocity = { x: vx, y: 0 }; landUntil = 0
            setSupportId(null); setMotion('fall'); recovering = true
        }
        const interrupted = () => document.visibilityState !== 'visible' || !document.hasFocus()
            || Boolean(document.activeElement?.closest('input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'))
            || Boolean(document.querySelector('[role="dialog"]'))
        const tick = (now: number) => {
            if (disposed) return
            const dt = (now - last) / 1000
            last = now
            if (interrupted()) {
                route = null; velocity = null; setMotion(null)
                nextAction = now + 5000
                queue(250); return
            }
            const pet = current.current.getPlacement()
            if (!pet.visible) { queue(250); return }
            // Reuse stable message geometry across animation frames. Scroll/mutations
            // invalidate it immediately; periodic refresh also catches CSS reflow.
            const size = `${pet.width}:${pet.height}`
            if (!cachedWorld || now - worldAt >= 100 || measuredSize !== size) {
                cachedWorld = readPetWorld(pet); worldAt = now; measuredSize = size
            }
            const world = cachedWorld
            if (initial) {
                initial = false
                const nearby = nearestSupport(pet, world)
                if (nearby) {
                    current.current.moveTo(standingPoint(pet, nearby))
                    attach(nearby, false, now); queue(160); return
                }
            }
            if (support) {
                const updated = world.surfaces.find(item => item.id === support!.id)
                const point = updated ? { x: pet.x + updated.left - support.left, y: updated.top - pet.height } : null
                // Follow ordinary scroll/reflow. Large jumps or clipped/removed ledges release the pet.
                if (!updated || !point || Math.abs(updated.top - support.top) > 160
                    || !hasFooting(point.x, pet.width, updated)
                    || !isPetPointSafe(point, pet, world.view, world.obstacles)) {
                    fall(route?.kind === 'walk' ? Math.sign(route.to.x - route.from.x) * 90 : 0)
                } else {
                    if (updated.top !== support.top || updated.left !== support.left) {
                        current.current.moveTo(point); route = null
                    }
                    support = updated
                }
            }
            if (route) {
                if (current.current.hovered) { route = null; setMotion(null); nextAction = now + 5000; queue(); return }
                const progress = Math.min(1, (now - began) / route.duration)
                const point = pointOnPetRoute(route, progress)
                if (!isPetPointSafe(point, pet, world.view, world.obstacles)) {
                    fall(); queue(); return
                }
                const hit = route.kind === 'jump' ? crossedSurface(pet, point, pet, world) : null
                if (hit) {
                    current.current.moveTo(standingPoint(pet, hit, point.x)); attach(hit, true, now)
                } else {
                    current.current.moveTo(point)
                    if (route.kind === 'walk' && support && !hasFooting(point.x, pet.width, support)) {
                        fall(Math.sign(route.to.x - route.from.x) * 90)
                    } else if (progress === 1) {
                        const landed = nearestSupport({ ...pet, ...point }, world, 2)
                        if (landed) attach(landed, route.kind === 'jump', now)
                        else fall()
                    }
                }
                queue(); return
            }
            if (!support) {
                if (!velocity) fall()
                const step = stepPetFall(pet, velocity!, dt, world)
                const placed = current.current.moveTo(step.point)
                velocity = step.velocity
                if (step.surface) attach(step.surface, true, now)
                else if (step.blocked) {
                    // Safety relocation wins over physics if the keyboard/editor expands mid-fall.
                    setPoof(value => value + 1)
                    const safe = nearestSupport(placed, readPetWorld(placed), 2)
                    if (safe) attach(safe, true, now)
                    else { velocity = { x: 0, y: 0 }; queue(160); return }
                }
                queue(); return
            }
            if (landUntil > now) { queue(); return }
            setMotion(null)
            if (now >= nextAction && !current.current.hovered) {
                route = choosePlatformRoute(current.current.getPlacement(), support, world)
                nextAction = now + 5000 + Math.random() * 5000
                if (route) {
                    began = now; setMotion(route.kind); setFacingLeft(route.to.x < route.from.x)
                    if (route.kind === 'jump') { support = null; setSupportId(null) }
                    queue(); return
                }
            }
            queue(160)
        }
        const layout = () => { cachedWorld = null; route = null; nextAction = performance.now() + 9000; queue() }
        const activity = () => { route = null; velocity = null; setMotion(null); nextAction = performance.now() + 9000; queue(160) }
        const observer = new MutationObserver(() => { cachedWorld = null; queue() })
        observer.observe(document.body, { childList: true, subtree: true })
        document.addEventListener('scroll', layout, true)
        window.addEventListener('resize', layout)
        window.visualViewport?.addEventListener('resize', layout)
        window.visualViewport?.addEventListener('scroll', layout)
        const events = ['pointerdown', 'keydown', 'focusin', 'visibilitychange'] as const
        events.forEach(event => document.addEventListener(event, activity, true))
        window.addEventListener('blur', activity)
        queue()
        return () => {
            disposed = true; clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect()
            document.removeEventListener('scroll', layout, true)
            window.removeEventListener('resize', layout)
            window.visualViewport?.removeEventListener('resize', layout)
            window.visualViewport?.removeEventListener('scroll', layout)
            events.forEach(event => document.removeEventListener(event, activity, true))
            window.removeEventListener('blur', activity)
        }
    }, [options.enabled, options.pet])
    return { motion, facingLeft, supportId, poof }
}
