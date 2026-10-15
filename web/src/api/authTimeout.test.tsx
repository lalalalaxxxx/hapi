import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/hooks/useAuth'
import { ApiClient } from './client'

function pendingUntilAborted(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
}

describe('authentication timeout', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('ends the startup spinner when the authentication connection stalls', async () => {
        let signal: AbortSignal | undefined
        vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => {
            signal = init.signal as AbortSignal
            return pendingUntilAborted(signal)
        }))
        const source = { type: 'accessToken' as const, token: 'test-only' }
        const { result } = renderHook(() => useAuth(source, 'https://hub.test'))
        expect(result.current.isLoading).toBe(true)
        await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
        expect(signal?.aborted).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.token).toBeNull()
        expect(result.current.error).toContain('Authentication timed out')
    })

    it('also bounds a response whose headers arrive but body stalls', async () => {
        vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({
            ok: true,
            json: () => pendingUntilAborted(init.signal as AbortSignal)
        })))
        const request = new ApiClient('').authenticate({ accessToken: 'test-only' })
        const rejected = expect(request).rejects.toThrow('Authentication timed out')
        await vi.advanceTimersByTimeAsync(15_000)
        await rejected
    })

    it('clears the deadline after successful authentication', async () => {
        const payload = { token: 'jwt-test', user: { id: 'user-test' } }
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload))))
        await expect(new ApiClient('').authenticate({ accessToken: 'test-only' })).resolves.toEqual(payload)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('preserves invalid-token errors and clears the deadline', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"invalid_token"}', { status: 401 })))
        await expect(new ApiClient('').authenticate({ accessToken: 'test-only' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' })
        expect(vi.getTimerCount()).toBe(0)
    })
})
