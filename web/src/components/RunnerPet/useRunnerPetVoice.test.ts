import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetVoice } from './useRunnerPetVoice'

const audio = vi.hoisted(() => ({ create: vi.fn(), play: vi.fn(), unlock: vi.fn(), stop: vi.fn(), dispose: vi.fn() }))
vi.mock('./voicePlayer', () => ({ PetVoicePlayer: class {
    constructor(pet: string) { audio.create(pet) }
    play = audio.play
    unlock = audio.unlock
    stop = audio.stop
    dispose = audio.dispose
} }))
const options: Parameters<typeof useRunnerPetVoice>[0] = { enabled: true, visible: true, machineId: '', pet: 'loopy' }

describe('pet voice lifecycle', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.spyOn(document, 'hasFocus').mockReturnValue(true) })
    afterEach(() => vi.restoreAllMocks())
    it('plays direct interaction and validated celebration callbacks', () => {
        const { result } = renderHook(useRunnerPetVoice, { initialProps: options })
        act(() => { result.current.interaction(); result.current.drag(); result.current.celebrate(); result.current.bored() })
        expect(audio.play.mock.calls).toEqual([['interact'], ['drag'], ['celebrate'], ['bored']])
    })
    it('disposes the previous pack and loads the selected pet without replaying speech', () => {
        const { rerender } = renderHook(useRunnerPetVoice, { initialProps: options })
        expect(audio.create).toHaveBeenLastCalledWith('loopy')
        rerender({ ...options, pet: 'companion' })
        expect(audio.dispose).toHaveBeenCalledOnce()
        expect(audio.create).toHaveBeenLastCalledWith('companion')
        expect(audio.play).not.toHaveBeenCalled()
    })
    it('stops on hiding and never queues missed events on return', () => {
        const { result, rerender } = renderHook(useRunnerPetVoice, { initialProps: options })
        audio.stop.mockClear()
        rerender({ ...options, visible: false })
        expect(audio.stop).toHaveBeenCalledOnce()
        act(() => { result.current.celebrate(); result.current.bored(); result.current.interaction() })
        rerender(options)
        expect(audio.play).not.toHaveBeenCalled()
    })
    it('disposes when muted and unmounted', () => {
        const { result, rerender, unmount } = renderHook(useRunnerPetVoice, { initialProps: options })
        rerender({ ...options, enabled: false })
        act(() => result.current.interaction())
        expect(audio.play).not.toHaveBeenCalled()
        expect(audio.dispose).toHaveBeenCalledOnce()
        rerender(options)
        unmount()
        expect(audio.dispose).toHaveBeenCalledTimes(2)
    })
    it('stops on focus loss or machine change and does not speak in another window', () => {
        const { result, rerender } = renderHook(useRunnerPetVoice, { initialProps: options })
        audio.stop.mockClear()
        act(() => window.dispatchEvent(new Event('blur')))
        expect(audio.stop).toHaveBeenCalledOnce()
        vi.mocked(document.hasFocus).mockReturnValue(false)
        act(() => result.current.bored())
        expect(audio.play).not.toHaveBeenCalled()
        rerender({ ...options, machineId: 'other' })
        expect(audio.stop).toHaveBeenCalledTimes(2)
    })
})
