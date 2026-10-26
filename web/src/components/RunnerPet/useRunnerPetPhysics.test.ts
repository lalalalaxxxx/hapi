import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetPhysics } from './useRunnerPetPhysics'
import type { PetWorld } from './physics'
import type { PetPlacement } from './roaming'

const scene = vi.hoisted(() => ({ world: null as PetWorld | null }))
vi.mock('./petWorld', () => ({ readPetWorld: () => scene.world }))
const bubble = { id: 'message', left: 100, right: 400, top: 300, kind: 'bubble' as const }
const floor = { id: 'floor', left: 8, right: 792, top: 592, kind: 'floor' as const }
let placement: PetPlacement
const moveTo = vi.fn(point => (placement = { ...placement, ...point }))
const options = { enabled: true, pet: 'loopy', hovered: true, getPlacement: () => placement, moveTo }
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('Runner pet platform lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        scene.world = { view: { left: 0, top: 0, width: 800, height: 800 },
            obstacles: [{ left: 0, top: 600, width: 800, height: 200 }], surfaces: [{ ...bubble }, { ...floor }] }
        placement = { x: 200, y: 212, width: 80, height: 80, visible: true }
        moveTo.mockClear()
    })
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

    it('snaps after release and follows its supporting message during scroll/reflow', () => {
        const { result, unmount } = renderHook(useRunnerPetPhysics, { initialProps: options })
        advance(40)
        expect(placement.y).toBe(220)
        expect(result.current.supportId).toBe('message')
        scene.world!.surfaces[0] = { ...bubble, top: 270 }
        act(() => document.dispatchEvent(new Event('scroll')))
        advance(40)
        expect(placement.y).toBe(190)
        expect(result.current.supportId).toBe('message')
        unmount(); expect(vi.getTimerCount()).toBe(0)
    })
    it('falls when a message disappears, lands safely and produces a recovery puff', () => {
        const { result, unmount } = renderHook(useRunnerPetPhysics, { initialProps: options })
        advance(40)
        scene.world!.surfaces = [floor]
        advance(200)
        expect(result.current.motion).toBe('fall')
        expect(placement.y).toBeGreaterThan(220)
        advance(1500)
        expect(placement.y + placement.height).toBe(592)
        expect(result.current.supportId).toBe('floor')
        expect(result.current.poof).toBe(1)
        unmount()
    })
    it('cancels movement while dragging or in a detail panel, then attaches at the new location', () => {
        const { result, rerender, unmount } = renderHook(useRunnerPetPhysics, { initialProps: options })
        advance(40)
        rerender({ ...options, enabled: false })
        expect(vi.getTimerCount()).toBe(0)
        placement = { ...placement, x: 250, y: 215 }
        rerender(options); advance(40)
        expect(result.current.supportId).toBe('message')
        expect(placement).toMatchObject({ x: 250, y: 220 })
        unmount()
    })
    it('pauses while typing and resumes gravity after input loses focus', () => {
        const { result, unmount } = renderHook(useRunnerPetPhysics, { initialProps: options })
        advance(40)
        const input = document.createElement('textarea'); document.body.append(input)
        act(() => input.focus())
        scene.world!.surfaces = [floor]
        advance(1000)
        expect(placement.y).toBe(220)
        act(() => input.blur()); input.remove()
        advance(1500)
        expect(result.current.supportId).toBe('floor')
        unmount()
    })
    it('recovers above an expanding composer during a fall', () => {
        placement = { ...placement, x: 500, y: 350 }
        const { unmount } = renderHook(useRunnerPetPhysics, { initialProps: options })
        advance(80)
        scene.world!.obstacles[0].top = 420
        scene.world!.surfaces = [{ ...floor, top: 412 }]
        // The positioning hook also clamps immediately on an editor resize.
        placement = { ...placement, y: 332 }
        act(() => window.dispatchEvent(new Event('resize')))
        advance(500)
        expect(placement.y + placement.height).toBeLessThanOrEqual(412)
        unmount(); expect(vi.getTimerCount()).toBe(0)
    })
})
