import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRunnerPetSettings } from './useRunnerPetSettings'

const key = 'hapi-runner-pet-settings'
describe('Runner pet selection and motion preferences', () => {
    beforeEach(() => {
        localStorage.clear()
        window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    it.each(['bad json', '{"pet":"unknown","roaming":0,"motion":"invalid"}', 'null'])('falls back safely for %s', raw => {
        localStorage.setItem(key, raw)
        const { result } = renderHook(useRunnerPetSettings)
        expect(result.current).toMatchObject({ pet: 'loopy', roaming: true, motion: 'system' })
    })
    it('switches all consumers immediately, preserves other settings and persists on remount', () => {
        const first = renderHook(useRunnerPetSettings)
        const second = renderHook(useRunnerPetSettings)
        act(() => first.result.current.updateRunnerPetSettings({ pet: 'loopy', motion: 'always' }))
        act(() => second.result.current.updateRunnerPetSettings({ roaming: false }))
        expect(first.result.current).toMatchObject({ pet: 'loopy', roaming: false, motion: 'always' })
        first.unmount()
        const restored = renderHook(useRunnerPetSettings)
        expect(restored.result.current.pet).toBe('loopy')
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ pet: 'loopy', roaming: false, motion: 'always' })
    })
    it('responds to updates and resets from another tab', () => {
        const { result } = renderHook(useRunnerPetSettings)
        act(() => {
            localStorage.setItem(key, JSON.stringify({ pet: 'loopy', roaming: false }))
            window.dispatchEvent(new StorageEvent('storage', { key }))
        })
        expect(result.current).toMatchObject({ pet: 'loopy', roaming: false, motion: 'system' })
        act(() => {
            localStorage.clear()
            window.dispatchEvent(new StorageEvent('storage', { key: null }))
        })
        expect(result.current.pet).toBe('loopy')
    })
    it('defaults to Loopy without replacing an explicitly saved character', () => {
        const first = renderHook(useRunnerPetSettings)
        expect(first.result.current.pet).toBe('loopy')
        act(() => first.result.current.updateRunnerPetSettings({ pet: 'companion' }))
        first.unmount()
        const restored = renderHook(useRunnerPetSettings)
        expect(restored.result.current.pet).toBe('companion')
    })
    it('supports switching when persistent storage is unavailable', () => {
        const { result } = renderHook(useRunnerPetSettings)
        const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
        try {
            act(() => result.current.updateRunnerPetSettings({ pet: 'loopy' }))
            expect(result.current.pet).toBe('loopy')
            act(() => result.current.updateRunnerPetSettings({ roaming: false }))
            expect(result.current).toMatchObject({ pet: 'loopy', roaming: false })
        } finally { write.mockRestore() }
    })
})
