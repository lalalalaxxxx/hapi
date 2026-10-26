import { useEffect, useRef, useState } from 'react'
import { choosePetRoute, isPetPointSafe, pointOnPetRoute, type PetPlacement } from './roaming'
import type { PetPoint } from './position'
import { RUNNER_PET_ANIMATIONS } from './animations'
import { runnerPetObstacles, runnerPetViewport } from './useRunnerPetPosition'

export function useRunnerPetRoaming(options: {
    enabled: boolean
    pet: string
    getPlacement: () => PetPlacement
    moveTo: (point: PetPoint) => PetPlacement
}) {
    const [motion, setMotion] = useState<'walk' | 'jump' | 'land' | null>(null)
    const [facingLeft, setFacingLeft] = useState(false)
    const current = useRef(options)
    current.current = options
    useEffect(() => {
        setMotion(null)
        if (!options.enabled) return
        let timer: ReturnType<typeof setTimeout>
        let frame = 0
        let disposed = false
        const interrupted = () => document.visibilityState !== 'visible' || !document.hasFocus()
            || Boolean(document.activeElement?.closest('input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'))
            || Boolean(document.querySelector('[role="dialog"]'))
        const schedule = (delay = 5000 + Math.random() * 5000) => {
            clearTimeout(timer)
            if (!disposed) timer = setTimeout(start, delay)
        }
        const stop = () => {
            cancelAnimationFrame(frame)
            setMotion(null)
            schedule(9000)
        }
        const start = () => {
            if (disposed) return
            if (interrupted()) { schedule(); return }
            const pet = current.current.getPlacement()
            const route = choosePetRoute(pet, runnerPetViewport(), runnerPetObstacles())
            if (!route) { schedule(); return }
            setFacingLeft(route.to.x < route.from.x)
            setMotion(route.kind)
            const begin = performance.now()
            const step = (now: number) => {
                if (disposed) return
                if (interrupted()) { stop(); return }
                const progress = Math.min(1, (now - begin) / route.duration)
                const point = pointOnPetRoute(route, progress)
                // Recheck each frame for keyboard, scroll, and composer-size changes.
                if (!isPetPointSafe(point, current.current.getPlacement(), runnerPetViewport(), runnerPetObstacles())) {
                    stop(); return
                }
                current.current.moveTo(point)
                if (progress < 1) { frame = requestAnimationFrame(step); return }
                if (route.kind === 'jump') {
                    setMotion('land')
                    timer = setTimeout(() => { setMotion(null); schedule() }, RUNNER_PET_ANIMATIONS.land.duration)
                } else { setMotion(null); schedule() }
            }
            frame = requestAnimationFrame(step)
        }
        schedule()
        const events = ['pointerdown', 'keydown', 'focusin', 'scroll', 'visibilitychange'] as const
        events.forEach(event => document.addEventListener(event, stop, true))
        window.addEventListener('resize', stop)
        window.addEventListener('blur', stop)
        window.visualViewport?.addEventListener('resize', stop)
        return () => {
            disposed = true
            clearTimeout(timer); cancelAnimationFrame(frame)
            events.forEach(event => document.removeEventListener(event, stop, true))
            window.removeEventListener('resize', stop)
            window.removeEventListener('blur', stop)
            window.visualViewport?.removeEventListener('resize', stop)
        }
    }, [options.enabled, options.pet])
    return { motion, facingLeft }
}
