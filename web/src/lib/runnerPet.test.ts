import { describe, expect, it } from 'vitest'
import type { Machine, SessionSummary } from '@/types/api'
import { getRunnerPetState } from './runnerPet'

const machine = (id = 'runner-1', active = true): Machine => ({
    id, active, namespace: 'default', seq: 0, createdAt: 0, updatedAt: 0, activeAt: 0,
    metadata: null, metadataVersion: 0, runnerState: { status: 'running' }, runnerStateVersion: 0,
})
const session = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    id: 'session-1', active: true, thinking: false, activeAt: 0, updatedAt: 0,
    metadata: { path: '/project', machineId: 'runner-1' }, metadataVersion: 0, agentStateVersion: 0,
    todosUpdatedAt: 0, todoProgress: null, pendingRequestsCount: 0, pendingRequestKinds: [], pendingRequests: [],
    backgroundTaskCount: 0, futureScheduledMessageCount: 0, nextScheduledAt: null, model: null, effort: null,
    ...overrides,
})

describe('Runner companion state', () => {
    it('does not present stale cached work as a live state while disconnected or loading', () => {
        for (const uncertainty of [{ connected: false }, { loading: true }, { hasError: true }]) {
            expect(getRunnerPetState({ machines: [machine()], sessions: [session({ thinking: true })], connected: true, ...uncertainty }).mood).toBe('connecting')
        }
    })
    it('prioritizes pending approvals and answers over other busy sessions', () => {
        expect(getRunnerPetState({ machines: [machine()], sessions: [session({ pendingRequestsCount: 2 }), session({ thinking: true })], connected: true }))
            .toMatchObject({ mood: 'waiting', onlineCount: 1, workingCount: 1, waitingCount: 1 })
    })
    it('counts background work and ignores archived or unassociated sessions', () => {
        const state = getRunnerPetState({ machines: [machine()], sessions: [
            session({ backgroundTaskCount: 2 }), session({ active: false, thinking: true }),
            session({ metadata: null, pendingRequestsCount: 1 }),
        ], connected: true })
        expect(state).toMatchObject({ mood: 'working', workingCount: 1, waitingCount: 0 })
    })
    it('keeps machine selection isolated, including an offline selected machine', () => {
        expect(getRunnerPetState({ machines: [machine(), machine('other', false)], sessions: [session({ thinking: true })], machineId: 'other', connected: true }))
            .toMatchObject({ mood: 'offline', onlineCount: 0, workingCount: 0 })
    })
    it('treats shutdown as offline and connected idle runners as ready', () => {
        expect(getRunnerPetState({ machines: [{ ...machine(), runnerState: { status: 'shutting-down' } }], sessions: [], connected: true }).mood).toBe('offline')
        expect(getRunnerPetState({ machines: [machine()], sessions: [], connected: true }).mood).toBe('idle')
    })
})
