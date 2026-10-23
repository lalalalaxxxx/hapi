import { describe, expect, it } from 'bun:test'
import { Store } from '../store'
import { SessionCache } from './sessionCache'
import type { EventPublisher } from './eventPublisher'

describe('removed session cache retention', () => {
    it.each(['delete', 'merge', 'refresh'])('releases per-session bookkeeping on %s', async kind => {
        const store = new Store(':memory:')
        const cache = new SessionCache(store, { emit() {} } as unknown as EventPublisher)
        const session = cache.getOrCreateSession('old', { path: '/tmp', host: 'test' }, null, 'default')
        const retained = cache as unknown as Record<string, Map<string, unknown> | Set<string>>
        const keys = ['lastBroadcastAtBySessionId', 'todoBackfillAttemptedSessionIds',
            'pendingThinkingUntilBySessionId', 'runtimeConfigUpdatedAtBySessionId',
            'agentProgressAtBySessionId', 'deduplicatePending']
        for (const key of keys) {
            const entries = retained[key]
            if (entries instanceof Set) entries.add(session.id)
            else entries.set(session.id, key === 'runtimeConfigUpdatedAtBySessionId' ? { model: 1 } : 1)
        }
        if (kind === 'delete') await cache.deleteSession(session.id)
        if (kind === 'merge') {
            const next = cache.getOrCreateSession('new', { path: '/tmp', host: 'test' }, null, 'default')
            await cache.mergeSessions(session.id, next.id, 'default')
            expect(cache.getSession(next.id)).toBeDefined()
        }
        if (kind === 'refresh') {
            store.sessions.deleteSession(session.id, 'default')
            cache.refreshSession(session.id)
        }
        expect(cache.getSession(session.id)).toBeUndefined()
        for (const key of keys) expect(retained[key].has(session.id)).toBe(false)
    })
})
