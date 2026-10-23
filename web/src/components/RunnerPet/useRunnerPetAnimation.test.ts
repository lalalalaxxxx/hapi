import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Machine, SessionSummary } from '@/types/api'
import { notifyRunnerPetToast } from '@/lib/runnerPetEvents'
import { RUNNER_PET_BORED_AFTER_MS, RUNNER_PET_CELEBRATE_MS } from './animations'
import { useRunnerPetAnimation } from './useRunnerPetAnimation'

const machine: Machine = { id: 'runner', namespace: 'default', active: true, activeAt: 0, seq: 0,
    createdAt: 0, updatedAt: 0, metadata: null, metadataVersion: 0, runnerStateVersion: 0,
    runnerState: { status: 'running' } }
const session: SessionSummary = { id: 'task', active: true, thinking: false, activeAt: 0, updatedAt: 0,
    metadata: { path: '/project', machineId: 'runner' }, metadataVersion: 0, agentStateVersion: 0,
    todosUpdatedAt: 0, todoProgress: null, pendingRequestsCount: 0, pendingRequestKinds: [], pendingRequests: [],
    backgroundTaskCount: 0, futureScheduledMessageCount: 0, nextScheduledAt: null, model: null, effort: null }
const options: Parameters<typeof useRunnerPetAnimation>[0] = {
    mood: 'idle', visible: true, machineId: '', machines: [machine], sessions: [session],
}

describe('Runner companion animation transitions', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('plays tap then happy, returning to the current live mood', () => {
        const { result, rerender } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => result.current.interact())
        expect(result.current.animation).toBe('tap')
        act(() => vi.advanceTimersByTime(1999))
        expect(result.current.animation).toBe('tap')
        act(() => vi.advanceTimersByTime(1))
        expect(result.current.animation).toBe('happy')
        rerender({ ...options, mood: 'working' })
        act(() => vi.advanceTimersByTime(2000))
        expect(result.current.animation).toBe('working')
    })

    it('resets a repeated tap instead of letting an old timer interrupt it', () => {
        const { result } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => result.current.interact())
        act(() => vi.advanceTimersByTime(1000))
        act(() => result.current.interact())
        act(() => vi.advanceTimersByTime(300))
        expect(result.current.animation).toBe('tap')
        act(() => vi.advanceTimersByTime(1700))
        expect(result.current.animation).toBe('happy')
    })

    it('gets bored only while visibly idle, then resets after interaction', () => {
        const { result, rerender } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => vi.advanceTimersByTime(RUNNER_PET_BORED_AFTER_MS))
        expect(result.current.animation).toBe('bored')
        act(() => result.current.interact())
        expect(result.current.animation).toBe('tap')
        rerender({ ...options, mood: 'waiting' })
        act(() => vi.advanceTimersByTime(RUNNER_PET_BORED_AFTER_MS))
        expect(result.current.animation).toBe('waiting')
        rerender({ ...options, visible: false })
        act(() => vi.advanceTimersByTime(RUNNER_PET_BORED_AFTER_MS))
        expect(result.current.animation).toBe('idle')
    })

    it('celebrates an explicit completion and then returns to idle', () => {
        const { result } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).toBe('celebrate')
        act(() => vi.advanceTimersByTime(RUNNER_PET_CELEBRATE_MS))
        expect(result.current.animation).toBe('idle')
    })

    it('announces only a validated completion, not failure or a pending approval', () => {
        const onCelebrate = vi.fn()
        const { rerender } = renderHook(useRunnerPetAnimation, { initialProps: { ...options, onCelebrate } })
        act(() => notifyRunnerPetToast({ title: 'Task failed', sessionId: 'task' }))
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'unknown' }))
        expect(onCelebrate).not.toHaveBeenCalled()
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(onCelebrate).toHaveBeenCalledOnce()
        rerender({ ...options, onCelebrate, sessions: [{ ...session, pendingRequestsCount: 1 }] })
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(onCelebrate).toHaveBeenCalledOnce()
    })

    it('does not celebrate a stopped, failed, missing, or paused session', () => {
        const { result, rerender } = renderHook(useRunnerPetAnimation, { initialProps: { ...options, mood: 'working' } })
        rerender(options)
        expect(result.current.animation).toBe('idle')
        for (const title of ['Task failed', 'Ready for input', 'Permission Request']) {
            act(() => notifyRunnerPetToast({ title, sessionId: 'task' }))
            expect(result.current.animation).toBe('idle')
        }
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'unknown' }))
        expect(result.current.animation).toBe('idle')
        rerender({ ...options, sessions: [{ ...session, active: false }] })
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).toBe('idle')
    })

    it.each(['connecting', 'offline', 'waiting'] as const)('ignores completion during %s', mood => {
        const { result } = renderHook(useRunnerPetAnimation, { initialProps: { ...options, mood } })
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).not.toBe('celebrate')
    })

    it('isolates selected machines and clears transient state on selection changes', () => {
        const { result, rerender } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).toBe('celebrate')
        rerender({ ...options, machineId: 'other' })
        expect(result.current.animation).toBe('idle')
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).toBe('idle')
    })

    it('cancels timers in hidden tabs and unsubscribes on unmount', () => {
        const { result, rerender, unmount } = renderHook(useRunnerPetAnimation, { initialProps: options })
        act(() => result.current.interact())
        rerender({ ...options, visible: false })
        expect(vi.getTimerCount()).toBe(0)
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(result.current.animation).toBe('idle')
        unmount()
        act(() => notifyRunnerPetToast({ title: 'Task completed', sessionId: 'task' }))
        expect(vi.getTimerCount()).toBe(0)
    })
})
