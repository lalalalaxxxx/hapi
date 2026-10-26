import { describe, expect, it } from 'vitest'
import { choosePetRoute, isPetPointSafe, pointOnPetRoute } from './roaming'
import { runnerPetAsset } from './animations'

describe('Runner pet safe roaming routes', () => {
    const view = { left: 0, top: 0, width: 390, height: 844 }
    const composer = { left: 0, top: 610, width: 390, height: 234 }
    const pet = { x: 270, y: 500, width: 80, height: 80, visible: true }

    it('walks horizontally and jumps along a continuous arc with exact endpoints', () => {
        const walk = choosePetRoute(pet, view, [composer], () => .2)!
        expect(walk.kind).toBe('walk')
        expect(pointOnPetRoute(walk, 0)).toEqual(walk.from)
        expect(pointOnPetRoute(walk, 1)).toEqual(walk.to)
        expect(pointOnPetRoute(walk, .5).y).toBe(pet.y)
        const jump = choosePetRoute({ ...pet, x: 100 }, view, [composer], () => .6)!
        expect(jump.kind).toBe('jump')
        expect(pointOnPetRoute(jump, .5).y).toBeLessThan(Math.min(jump.from.y, jump.to.y))
    })

    it('keeps every sampled point clear of the composer and keyboard viewport', () => {
        let seed = 71
        const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
        let routes = 0
        for (const height of [844, 430]) {
            const viewport = { ...view, height }
            const obstacle = { ...composer, top: height - 180 }
            const start = { ...pet, y: height - 280 }
            for (let i = 0; i < 100; i++) {
                const route = choosePetRoute(start, viewport, [obstacle], random)
                if (!route) continue
                routes++
                for (let step = 0; step <= 200; step++) {
                    expect(isPetPointSafe(pointOnPetRoute(route, step / 200), start, viewport, [obstacle])).toBe(true)
                }
            }
        }
        expect(routes).toBeGreaterThan(100)
    })

    it('does not start when hidden or blocked, or cross a full-height editor', () => {
        expect(choosePetRoute({ ...pet, visible: false }, view, [])).toBeNull()
        expect(choosePetRoute(pet, view, [view])).toBeNull()
        const wall = { left: 120, top: 0, width: 60, height: 844 }
        const left = { ...pet, x: 20, y: 300 }
        expect(choosePetRoute(left, view, [wall], () => .6)).toBeNull()
    })

    it('keeps approved companion artwork and selects Loopy animations and posters', () => {
        expect(runnerPetAsset('jump')).toContain('/loopy-v1/jump.webp')
        expect(runnerPetAsset('jump', false, 'companion')).toContain('/runner-v2/happy.webp')
        expect(runnerPetAsset('jump', false, 'loopy')).toContain('/loopy-v1/jump.webp')
        expect(runnerPetAsset('drag', true, 'loopy')).toContain('/loopy-v1/static/drag.webp')
        expect(runnerPetAsset('idle')).toContain('/loopy-v1/idle-stable.webp')
        expect(runnerPetAsset('working')).toContain('/loopy-v1/working-stable.webp')
        expect(runnerPetAsset('idle', true)).toContain('/loopy-v1/static/idle.webp')
    })
})
