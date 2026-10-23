import { describe, expect, it } from 'vitest'
import { placeRunnerPet } from './position'

const size = { width: 80, height: 120 }
const phone = { left: 0, top: 0, width: 390, height: 844 }

describe('Runner pet safe positioning', () => {
    it('clamps a dragged character to the visible viewport', () => {
        expect(placeRunnerPet({ x: -400, y: 1000 }, size, phone, []))
            .toEqual({ x: 8, y: 716, ...size, visible: true })
    })
    it('keeps the complete sprite above a full-width composer', () => {
        const result = placeRunnerPet({ x: 300, y: 700 }, size, phone,
            [{ left: 0, top: 600, width: 390, height: 244 }])
        expect(result.visible).toBe(true)
        expect(result.y + result.height).toBeLessThanOrEqual(592)
    })
    it('can stay beside a desktop composer instead of jumping upward', () => {
        const result = placeRunnerPet({ x: 20, y: 700 }, size, { ...phone, width: 1280, height: 900 },
            [{ left: 400, top: 600, width: 880, height: 300 }])
        expect(result.x).toBe(20)
        expect(result.y).toBe(700)
    })
    it('respects keyboard-reduced viewport and its scroll offset', () => {
        const result = placeRunnerPet({ x: 300, y: 700 }, size, { left: 0, top: 80, width: 390, height: 400 },
            [{ left: 0, top: 340, width: 390, height: 140 }])
        expect(result.y).toBeGreaterThanOrEqual(88)
        expect(result.y + result.height).toBeLessThanOrEqual(332)
    })
    it('shrinks if necessary, and never covers a full-screen editor', () => {
        const small = placeRunnerPet({ x: 300, y: 700 }, size, phone,
            [{ left: 0, top: 85, width: 390, height: 759 }])
        expect(small.visible).toBe(true)
        expect(small.height).toBe(60)
        expect(placeRunnerPet({ x: 300, y: 700 }, size, phone, [phone]).visible).toBe(false)
    })
})
