import { describe, expect, it } from 'vitest'
import { choosePlatformRoute, crossedSurface, hasFooting, nearestSupport, stepPetFall, type PetWorld } from './physics'
import { isPetPointSafe, pointOnPetRoute } from './roaming'

const bubble = { id: 'message-1', left: 120, right: 350, top: 300, kind: 'bubble' as const }
const lower = { ...bubble, id: 'message-2', top: 470 }
const floor = { id: 'floor', left: 8, right: 792, top: 612, kind: 'floor' as const }
const world: PetWorld = { view: { left: 0, top: 0, width: 800, height: 800 },
    obstacles: [{ left: 0, top: 620, width: 800, height: 180 }], surfaces: [bubble, lower, floor] }
const pet = { x: 200, y: 210, width: 80, height: 80, visible: true }

describe('Runner pet platform physics', () => {
    it('snaps feet near a message top, without attracting distant pets or edges', () => {
        expect(nearestSupport(pet, world)?.id).toBe(bubble.id)
        expect(nearestSupport({ ...pet, y: 120 }, world)).toBeNull()
        expect(hasFooting(80, 80, bubble)).toBe(false)
        expect(nearestSupport({ ...pet, x: 400 }, world)).toBeNull()
    })
    it('lands on the first crossed platform, never on ascent', () => {
        expect(crossedSurface({ x: 200, y: 100 }, { x: 200, y: 500 }, pet, world)?.id).toBe(bubble.id)
        expect(crossedSurface({ x: 200, y: 500 }, { x: 200, y: 100 }, pet, world)).toBeNull()
        expect(crossedSurface({ x: 400, y: 100 }, { x: 400, y: 500 }, pet, world)).toBeNull()
    })
    it('accelerates under gravity, lands precisely and clears velocity', () => {
        let body = { ...pet, y: 80 }, velocity = { x: 0, y: 0 }
        let lastSpeed = 0, landed = false
        for (let i = 0; i < 100; i++) {
            const result = stepPetFall(body, velocity, 1 / 60, world)
            expect(result.blocked).toBe(false)
            body = { ...body, ...result.point }; velocity = result.velocity
            if (result.surface) {
                expect(body.y + body.height).toBe(bubble.top)
                expect(velocity).toEqual({ x: 0, y: 0 }); landed = true; break
            }
            expect(velocity.y).toBeGreaterThan(lastSpeed); lastSpeed = velocity.y
        }
        expect(landed).toBe(true)
    })
    it('falls to the next bubble after removal and remains above the input', () => {
        const removed = { ...world, surfaces: [lower, floor] }
        let body = { ...pet, y: 220 }, velocity = { x: 60, y: 0 }
        let landed = ''
        for (let i = 0; i < 100; i++) {
            const result = stepPetFall(body, velocity, .04, removed)
            body = { ...body, ...result.point }; velocity = result.velocity
            expect(isPetPointSafe(body, body, world.view, world.obstacles)).toBe(true)
            if (result.surface) { landed = result.surface.id; break }
        }
        expect(landed).toBe(lower.id)
        const overEditor = stepPetFall({ ...pet, x: 500, y: 530 }, { x: 0, y: 1000 }, .05, world)
        expect(overEditor.surface?.id).toBe(floor.id)
        expect(overEditor.point.y + pet.height).toBe(612)
    })
    it('keeps platform jumps clear of the input along the entire arc', () => {
        const route = choosePlatformRoute({ ...pet, y: 220 }, bubble, world, () => .5)!
        expect(route.kind).toBe('jump')
        expect(route.to.y + pet.height).toBe(lower.top)
        for (let i = 0; i <= 100; i++) expect(isPetPointSafe(pointOnPetRoute(route, i / 100), pet, world.view, world.obstacles)).toBe(true)
    })
    it('walks beyond a ledge so gravity can take over, and bounds long frame gaps', () => {
        const route = choosePlatformRoute({ ...pet, x: 290, y: 220 }, bubble, { ...world, surfaces: [bubble, floor] }, () => .9)!
        expect(route.kind).toBe('walk')
        expect(hasFooting(route.to.x, pet.width, bubble)).toBe(false)
        expect(stepPetFall(pet, { x: 0, y: 0 }, 10, world).point.y).toBeLessThan(pet.y + 2)
    })
})
