import { placeRunnerPet, type PetPoint, type PetRect } from './position'
import { RUNNER_PET_ANIMATIONS } from './animations'

export type PetPlacement = PetPoint & { width: number; height: number; visible: boolean }
export type PetRoute = { from: PetPoint; to: PetPoint; lift: number; duration: number; kind: 'walk' | 'jump' }

export function pointOnPetRoute(route: PetRoute, progress: number): PetPoint {
    const t = Math.max(0, Math.min(1, progress))
    const eased = t * t * (3 - 2 * t)
    return { x: route.from.x + (route.to.x - route.from.x) * eased,
        y: route.from.y + (route.to.y - route.from.y) * eased - 4 * route.lift * t * (1 - t) }
}

export function isPetPointSafe(point: PetPoint, pet: PetPlacement, view: PetRect, obstacles: PetRect[]) {
    const safe = placeRunnerPet(point, pet, view, obstacles)
    return safe.visible && safe.width === pet.width && safe.height === pet.height
        && Math.abs(safe.x - point.x) < .5 && Math.abs(safe.y - point.y) < .5
}

export function choosePetRoute(pet: PetPlacement, view: PetRect, obstacles: PetRect[], random = Math.random): PetRoute | null {
    if (!pet.visible) return null
    const walk = random() < .35
    for (let attempt = 0; attempt < 12; attempt++) {
        const direction = random() < .5 ? -1 : 1
        const distance = Math.min(view.width * .6, 80 + random() * 190)
        const desired = { x: pet.x + direction * distance,
            y: walk ? pet.y : pet.y + (random() - .5) * Math.min(view.height * .5, 260) }
        const destination = placeRunnerPet(desired, pet, view, obstacles)
        if (!destination.visible || destination.width !== pet.width || destination.height !== pet.height) continue
        if (Math.hypot(destination.x - pet.x, destination.y - pet.y) < 48) continue
        const kind = walk && Math.abs(destination.y - pet.y) < 1 ? 'walk' : 'jump'
        const route: PetRoute = { from: { x: pet.x, y: pet.y }, to: { x: destination.x, y: destination.y },
            lift: kind === 'walk' ? 0 : Math.min(72, Math.max(0, Math.min(pet.y, destination.y) - view.top - 12)),
            duration: RUNNER_PET_ANIMATIONS[kind].duration, kind }
        // Check the entire arc, not only its destination: never hop through the composer.
        if (Array.from({ length: 31 }, (_, i) => pointOnPetRoute(route, i / 30))
            .every(point => isPetPointSafe(point, pet, view, obstacles))) return route
    }
    return null
}
