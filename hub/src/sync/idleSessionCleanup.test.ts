import { afterEach, describe, expect, it } from 'bun:test'
import { Store } from '../store'
import { RpcRegistry } from '../socket/rpcRegistry'
import { SyncEngine } from './syncEngine'
import type { SessionCache } from './sessionCache'

const engines: SyncEngine[] = []
afterEach(() => { for (const engine of engines.splice(0)) engine.stop() })

function fixture() {
    const store = new Store(':memory:')
    const engine = new SyncEngine(store, {} as never, new RpcRegistry(), { broadcast() {} } as never)
    engines.push(engine)
    const cache = (engine as unknown as { sessionCache: SessionCache }).sessionCache
    const session = cache.getOrCreateSession('idle', {
        path: '/tmp/project', host: 'test', machineId: 'machine', startedBy: 'runner',
        flavor: 'codex', codexSessionId: 'native-thread', lifecycleState: 'idle'
    }, null, 'default')
    cache.markSessionActive(session.id)
    const rpc = (engine as unknown as { rpcGateway: {
        killSession: () => Promise<object>
        stopRunnerSession: () => Promise<string>
    } }).rpcGateway
    rpc.killSession = async () => ({})
    rpc.stopRunnerSession = async () => 'stopped'
    return { store, engine, session: cache.getSession(session.id)!, cache, rpc }
}

describe('idle session cleanup', () => {
    it('stops idle processes while retaining native identity and history for reopen', async () => {
        const { engine, store, session } = fixture()
        store.messages.addMessage(session.id, { role: 'agent', content: { type: 'text', text: 'saved history' } })
        expect(await engine.archiveIdleSession(session.id)).toBe(true)
        expect(engine.getSession(session.id)?.active).toBe(false)
        expect(engine.getSession(session.id)?.metadata?.lifecycleState).toBe('archived')
        expect(store.sessions.getSession(session.id)?.metadata).toMatchObject({ codexSessionId: 'native-thread' })
        expect(store.messages.getAllMessages(session.id)).toHaveLength(1)
    })

    it.each(['thinking', 'background', 'permission', 'queued', 'scheduled', 'exempt', 'recent'])('skips %s work', async kind => {
        const { engine, store, session, rpc } = fixture()
        let stopped = false
        rpc.killSession = async () => { stopped = true; return {} }
        if (kind === 'thinking') session.thinking = true
        if (kind === 'background') session.backgroundTaskCount = 1
        if (kind === 'permission') session.agentState = { requests: { request: { tool: 'Bash', arguments: {}, createdAt: 1 } } }
        if (kind === 'exempt') session.metadata!.idleReconcileExempt = true
        if (kind === 'recent') session.metadata!.lifecycleState = 'running'
        if (kind === 'queued' || kind === 'scheduled') {
            store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'pending input' } }, 'queued',
                kind === 'scheduled' ? Date.now() + 60_000 : undefined)
        }
        expect(await engine.archiveIdleSession(session.id)).toBe(false)
        expect(stopped).toBe(false)
        expect(engine.getSession(session.id)?.active).toBe(true)
    })

    it('also cleans stale running rows whose socket has disconnected', async () => {
        const { engine, session } = fixture()
        session.active = false
        session.metadata!.lifecycleState = 'running'
        expect(await engine.archiveIdleSession(session.id)).toBe(true)
    })

    it('retains the session when the runner cannot confirm termination', async () => {
        const { engine, session, rpc } = fixture()
        rpc.stopRunnerSession = async () => 'unknown'
        await expect(engine.archiveIdleSession(session.id)).rejects.toThrow('still running')
        expect(engine.getSession(session.id)?.active).toBe(true)
    })
})
