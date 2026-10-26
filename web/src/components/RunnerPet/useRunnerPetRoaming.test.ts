import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetRoaming } from './useRunnerPetRoaming'

describe('Runner pet autonomous movement lifecycle', () => {
    const placement = { x: 100, y: 300, width: 80, height: 80, visible: true }
    const moveTo = vi.fn(point => ({ ...placement, ...point }))
    const options = { enabled: true, pet: 'loopy', getPlacement: () => placement, moveTo }
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(Math, 'random').mockReturnValue(.6)
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        moveTo.mockClear()
    })
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
    const start = () => act(() => vi.advanceTimersByTime(8100))

    it('moves continuously, lands and resumes the logical animation', () => {
        const { result, unmount } = renderHook(useRunnerPetRoaming, { initialProps: options })
        start()
        expect(result.current.motion).toBe('jump')
        expect(moveTo.mock.calls.length).toBeGreaterThan(2)
        act(() => vi.advanceTimersByTime(920))
        expect(result.current.motion).toBe('land')
        act(() => vi.advanceTimersByTime(320))
        expect(result.current.motion).toBeNull()
        unmount()
        expect(vi.getTimerCount()).toBe(0)
    })
    it.each(['pointerdown', 'keydown', 'scroll', 'focusin'])('stops immediately on %s', event => {
        const { result, unmount } = renderHook(useRunnerPetRoaming, { initialProps: options })
        start()
        act(() => document.dispatchEvent(new Event(event)))
        expect(result.current.motion).toBeNull()
        const count = moveTo.mock.calls.length
        act(() => vi.advanceTimersByTime(1000))
        expect(moveTo).toHaveBeenCalledTimes(count)
        unmount()
    })
    it('stops and clears timers when dragging, opening details, switching pets or disabling motion', () => {
        const { result, rerender, unmount } = renderHook(useRunnerPetRoaming, { initialProps: options })
        start()
        rerender({ ...options, enabled: false })
        expect(result.current.motion).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
        rerender(options)
        start()
        rerender({ ...options, pet: 'companion' })
        expect(result.current.motion).toBeNull()
        unmount()
        expect(vi.getTimerCount()).toBe(0)
    })
    it('does not move while typing or in a hidden/unfocused page', () => {
        const input = document.createElement('textarea')
        document.body.append(input); input.focus()
        const { unmount } = renderHook(useRunnerPetRoaming, { initialProps: options })
        start()
        expect(moveTo).not.toHaveBeenCalled()
        input.remove()
        vi.mocked(document.hasFocus).mockReturnValue(false)
        start()
        expect(moveTo).not.toHaveBeenCalled()
        vi.mocked(document.hasFocus).mockReturnValue(true)
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        start()
        expect(moveTo).not.toHaveBeenCalled()
        unmount()
    })
})
