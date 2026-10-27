import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetDance } from './useRunnerPetDance'

const media = vi.hoisted(() => ({ create: vi.fn(), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() }))
vi.mock('./dancePlayer', () => ({
    BOBO_DANCES: ['pendulum', 'bounce'], DANCE_DURATION: 10_000,
    BoboDancePlayer: class {
        constructor() { media.create() }
        play = media.play
        stop = media.stop
        dispose = media.dispose
    },
}))
const options = { enabled: true, available: true, sound: true, machineId: '' }

describe('Bobo click dance scheduling', () => {
    beforeEach(() => {
        vi.useFakeTimers(); vi.clearAllMocks()
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        media.play.mockImplementation(async id => ({ id, image: {}, startedAt: performance.now() }))
    })
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
    it('randomly chooses either dance, ignores repeated clicks, and finishes after ten seconds', async () => {
        const random = vi.spyOn(Math, 'random').mockReturnValue(0)
        const { result } = renderHook(useRunnerPetDance, { initialProps: options })
        await act(() => result.current.start())
        expect(result.current.playback?.id).toBe('pendulum')
        await act(() => result.current.start())
        expect(media.play).toHaveBeenCalledTimes(1)
        act(() => vi.advanceTimersByTime(9999))
        expect(result.current.busy).toBe(true)
        act(() => vi.advanceTimersByTime(1))
        expect(result.current.playback).toBeNull()
        random.mockReturnValue(.99)
        await act(() => result.current.start())
        expect(result.current.playback?.id).toBe('bounce')
    })
    it('stops on mute, pickup/hidden state, focus loss, machine change and pet switch', async () => {
        const { result, rerender } = renderHook(useRunnerPetDance, { initialProps: options })
        await act(() => result.current.start())
        rerender({ ...options, sound: false })
        expect(result.current.playback).toBeNull()
        await act(() => result.current.start())
        expect(media.play).toHaveBeenLastCalledWith(expect.any(String), false)
        rerender({ ...options, available: false })
        expect(result.current.busy).toBe(false)
        rerender(options)
        await act(() => result.current.start())
        act(() => window.dispatchEvent(new Event('blur')))
        expect(result.current.playback).toBeNull()
        await act(() => result.current.start())
        rerender({ ...options, machineId: 'another' })
        expect(result.current.playback).toBeNull()
        rerender({ ...options, enabled: false })
        expect(media.dispose).toHaveBeenCalledOnce()
    })
    it('does not let a cancelled loading request cancel a newer dance', async () => {
        let finish!: (result: null) => void
        media.play.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
        const { result } = renderHook(useRunnerPetDance, { initialProps: options })
        let pending!: Promise<void>
        act(() => { pending = result.current.start() })
        act(() => result.current.cancel())
        await act(() => result.current.start())
        expect(result.current.playback).not.toBeNull()
        await act(async () => { finish(null); await pending })
        expect(result.current.playback).not.toBeNull()
    })
    it('does not load media for Loopy or reduced motion, and never queues background clicks', async () => {
        const { result } = renderHook(useRunnerPetDance, { initialProps: { ...options, enabled: false } })
        await act(() => result.current.start())
        expect(media.create).not.toHaveBeenCalled()
        expect(media.play).not.toHaveBeenCalled()
    })
})
