import { placeRunnerPet, type PetPoint, type PetRect } from './position'
import { isPetPointSafe, pointOnPetRoute, type PetPlacement, type PetRoute } from './roaming'

export type PetSurface = { id: string; left: number; right: number; top: number; kind: 'bubble' | 'floor' }
export type PetWorld = { view: PetRect; obstacles: PetRect[]; surfaces: PetSurface[] }
export type PetVelocity = { x: number; y: number }
const GRAVITY = 1500 // CSS pixels / second squared, independent of display refresh rate.

export function hasFooting(x: number, width: number, surface: PetSurface) {
    const center = x + width / 2
    return center >= surface.left + 6 && center <= surface.right - 6
}

export function standingPoint(pet: PetPlacement, surface: PetSurface, x = pet.x): PetPoint {
    return { x, y: surface.top - pet.height }
}

export function nearestSupport(pet: PetPlacement, world: PetWorld, tolerance = 28) {
    return world.surfaces.filter(surface => hasFooting(pet.x, pet.width, surface)
        && Math.abs(pet.y + pet.height - surface.top) <= tolerance
        && isPetPointSafe(standingPoint(pet, surface), pet, world.view, world.obstacles))
        .sort((a, b) => Math.abs(pet.y + pet.height - a.top) - Math.abs(pet.y + pet.height - b.top))[0] ?? null
}

// One-way platforms: the pet can jump up through them, but lands on descent.
// Swept feet prevent tunnelling through thin bubbles even at a low frame rate.
export function crossedSurface(from: PetPoint, to: PetPoint, pet: PetPlacement, world: PetWorld) {
    if (to.y <= from.y) return null
    return world.surfaces.filter(surface => {
        if (from.y + pet.height > surface.top + .5 || to.y + pet.height < surface.top) return false
        const fraction = Math.max(0, Math.min(1, (surface.top - pet.height - from.y) / (to.y - from.y)))
        const x = from.x + (to.x - from.x) * fraction
        return hasFooting(x, pet.width, surface)
            && isPetPointSafe(standingPoint(pet, surface, x), pet, world.view, world.obstacles)
    }).sort((a, b) => a.top - b.top)[0] ?? null
}

export function stepPetFall(pet: PetPlacement, velocity: PetVelocity, dt: number, world: PetWorld) {
    // Bound delayed frames; resuming a background tab must not launch the pet.
    const seconds = Math.max(0, Math.min(dt, .05))
    const vy = Math.min(1000, velocity.y + GRAVITY * seconds)
    const x = Math.max(world.view.left + 8, Math.min(world.view.left + world.view.width - pet.width - 8, pet.x + velocity.x * seconds))
    const point = { x, y: pet.y + (velocity.y + vy) / 2 * seconds }
    const surface = crossedSurface(pet, point, pet, world)
    if (surface) return { point: standingPoint(pet, surface, x), velocity: { x: 0, y: 0 }, surface, blocked: false }
    const blocked = !isPetPointSafe(point, pet, world.view, world.obstacles)
    return { point: blocked ? placeRunnerPet(point, pet, world.view, world.obstacles) : point,
        velocity: { x: velocity.x * Math.exp(-seconds * .8), y: vy }, surface: null, blocked }
}

export function choosePlatformRoute(pet: PetPlacement, support: PetSurface, world: PetWorld, random = Math.random): PetRoute | null {
    const other = world.surfaces.filter(surface => surface.kind === 'bubble' && surface.id !== support.id
        && Math.abs(surface.top - support.top) <= 270)
    // Usually jump to a nearby message. Otherwise stroll, sometimes over an edge.
    if (other.length && random() < .72) {
        const offset = Math.floor(random() * other.length)
        for (let i = 0; i < other.length; i++) {
            const target = other[(i + offset) % other.length]
            const x = Math.max(target.left + 12 - pet.width / 2, Math.min(target.right - 12 - pet.width / 2, pet.x + (random() - .5) * 200))
            const to = standingPoint(pet, target, x)
            if (Math.abs(to.x - pet.x) > 420 || Math.hypot(to.x - pet.x, to.y - pet.y) < 30) continue
            const route: PetRoute = { from: pet, to, kind: 'jump', duration: 1000,
                lift: Math.min(80, Math.max(0, Math.min(pet.y, to.y) - world.view.top - 8)) }
            if (Array.from({ length: 41 }, (_, j) => pointOnPetRoute(route, j / 40))
                .every(point => isPetPointSafe(point, pet, world.view, world.obstacles))) return route
        }
    }
    const direction = random() < .5 ? -1 : 1
    for (const sign of [direction, -direction]) {
        const to = { x: pet.x + sign * (65 + random() * 65), y: pet.y }
        if (!isPetPointSafe(to, pet, world.view, world.obstacles)) continue
        const route: PetRoute = { from: pet, to, lift: 0, duration: 1400, kind: 'walk' }
        if (Array.from({ length: 25 }, (_, j) => pointOnPetRoute(route, j / 24))
            .every(point => isPetPointSafe(point, pet, world.view, world.obstacles))) return route
    }
    return null
}
