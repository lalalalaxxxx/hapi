import { useSyncExternalStore } from 'react'
import type { PetPlacement } from './roaming'
import type { PetSurface, PetWorld } from './physics'
import { runnerPetObstacles, runnerPetViewport } from './useRunnerPetPosition'

const WORLD = '[data-runner-pet-world]'
const SURFACE = '[data-runner-pet-surface]'
function subscribe(listener: () => void) {
    const observer = new MutationObserver(listener)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
}
export function useRunnerPetWorld() {
    return useSyncExternalStore(subscribe, () => Boolean(document.querySelector(WORLD)), () => false)
}

export function readPetWorld(pet: PetPlacement): PetWorld {
    const view = runnerPetViewport(), obstacles = runnerPetObstacles()
    const surfaces: PetSurface[] = []
    for (const node of document.querySelectorAll<HTMLElement>(`${WORLD} ${SURFACE}`)) {
        const rect = node.getBoundingClientRect()
        if (!rect.width || !rect.height || getComputedStyle(node).visibility === 'hidden') continue
        if (rect.top < view.top + pet.height + 8 || rect.top >= view.top + view.height - 8
            || rect.right < view.left || rect.left > view.left + view.width) continue
        let left = Math.max(rect.left, view.left + 8), right = Math.min(rect.right, view.left + view.width - 8)
        let top = view.top + 8, bottom = view.top + view.height - 8
        // Clip against every scrolling/overflow ancestor, including the thread viewport.
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent)
            const overflowX = style.overflowX || style.overflow, overflowY = style.overflowY || style.overflow
            if (!/(auto|scroll|hidden|clip)/.test(`${overflowX} ${overflowY}`)) continue
            const clip = parent.getBoundingClientRect()
            if (/(auto|scroll|hidden|clip)/.test(overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right) }
            if (/(auto|scroll|hidden|clip)/.test(overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom) }
        }
        // A cropped message's artificial viewport edge is not a real ledge.
        if (rect.top < top + pet.height || rect.top >= bottom || right - left < 32) continue
        surfaces.push({ id: node.dataset.runnerPetSurface!, left, right, top: rect.top, kind: 'bubble' })
    }
    surfaces.push({ id: 'viewport-floor', left: view.left + 8, right: view.left + view.width - 8,
        top: view.top + view.height - 8, kind: 'floor' })
    // Safe shelves above the composer prevent a fall from ever covering its controls.
    obstacles.forEach((rect, index) => surfaces.push({ id: `obstacle-floor-${index}`, left: rect.left - pet.width / 2,
        right: rect.left + rect.width + pet.width / 2, top: rect.top - 8, kind: 'floor' }))
    return { view, obstacles, surfaces }
}
