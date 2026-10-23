import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetPreference } from './useRunnerPetPreference'

describe('Runner companion preference', () => {
    beforeEach(() => {
        localStorage.clear()
        window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    it('synchronizes hiding and restoring across mounted consumers', () => {
        const first = renderHook(useRunnerPetPreference)
        const second = renderHook(useRunnerPetPreference)
        expect(first.result.current.runnerPetEnabled).toBe(true)
        act(() => first.result.current.setRunnerPetEnabled(false))
        expect(second.result.current.runnerPetEnabled).toBe(false)
        first.unmount()
        const restored = renderHook(useRunnerPetPreference)
        expect(restored.result.current.runnerPetEnabled).toBe(false)
        act(() => second.result.current.setRunnerPetEnabled(true))
        expect(restored.result.current.runnerPetEnabled).toBe(true)
    })
    it('remains usable when storage writes fail', () => {
        const { result } = renderHook(useRunnerPetPreference)
        const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded') })
        try {
            act(() => result.current.setRunnerPetEnabled(false))
            expect(result.current.runnerPetEnabled).toBe(false)
            act(() => result.current.setRunnerPetEnabled(true))
            expect(result.current.runnerPetEnabled).toBe(true)
        } finally { write.mockRestore() }
    })
    it('responds to preference changes and resets in another tab', () => {
        const { result } = renderHook(useRunnerPetPreference)
        act(() => {
            localStorage.setItem('hapi-runner-pet-enabled', 'false')
            window.dispatchEvent(new StorageEvent('storage', { key: 'hapi-runner-pet-enabled', newValue: 'false' }))
        })
        expect(result.current.runnerPetEnabled).toBe(false)
        act(() => {
            localStorage.clear()
            window.dispatchEvent(new StorageEvent('storage', { key: null }))
        })
        expect(result.current.runnerPetEnabled).toBe(true)
    })
})
