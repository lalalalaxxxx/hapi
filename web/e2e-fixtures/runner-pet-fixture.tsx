import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { I18nProvider } from '../src/lib/i18n-context'
import { RunnerPet } from '../src/components/RunnerPet'
import type { Machine, SessionSummary } from '../src/types/api'
import '../src/index.css'

localStorage.setItem('hapi-lang', 'zh-CN')
const machine: Machine = { id: 'preview', namespace: 'default', active: true, activeAt: 0, seq: 0, createdAt: 0, updatedAt: 0,
    metadata: { host: 'Guangzhou', displayName: '我的 Runner', platform: 'linux', happyCliVersion: '0.30.7' },
    metadataVersion: 0, runnerState: { status: 'running' }, runnerStateVersion: 0 }
const session: SessionSummary = { id: 'preview-session', active: true, thinking: false, activeAt: 0, updatedAt: 0,
    metadata: { path: '/project', machineId: 'preview' }, metadataVersion: 0, agentStateVersion: 0, todosUpdatedAt: 0,
    todoProgress: null, pendingRequestsCount: 0, pendingRequestKinds: [], pendingRequests: [], backgroundTaskCount: 0,
    futureScheduledMessageCount: 0, nextScheduledAt: null, model: null, effort: null }

function Preview() {
    const [mood, setMood] = useState('working')
    const [hidden, setHidden] = useState(false)
    return <I18nProvider>
        <main style={{ minHeight: '100dvh', padding: 'clamp(24px, 6vw, 80px)', background: 'var(--app-bg)', color: 'var(--app-fg)' }}>
            <p style={{ color: 'var(--app-hint)', fontSize: 12, letterSpacing: 3 }}>HAPI / RUNNER COMPANION</p>
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 650, margin: '20px 0 12px' }}>你认真创造，<br />我负责陪伴。</h1>
            <p style={{ color: 'var(--app-hint)', fontSize: 14 }}>点一点角落里的小伙伴，看看它在忙什么。</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28, maxWidth: 390 }}>
                {Object.entries({ idle: '准备好了', working: '忙碌中', waiting: '等你回应', offline: '休息中', connecting: '连接中' }).map(([value, label]) =>
                    <button key={value} onClick={() => setMood(value)} style={{ border: '1px solid var(--app-border)', borderRadius: 20, padding: '8px 14px', fontSize: 12,
                        background: value === mood ? 'var(--app-fg)' : 'var(--app-bg)', color: value === mood ? 'var(--app-bg)' : 'var(--app-fg)' }}>{label}</button>)}
                {hidden && <button onClick={() => setHidden(false)}>叫点点回来</button>}
            </div>
            <p style={{ color: 'var(--app-hint)', fontSize: 11, marginTop: 18 }}>交互预览 · 使用模拟状态</p>
        </main>
        {!hidden && <RunnerPet machines={[{ ...machine, active: mood !== 'offline' }]} sessions={[{ ...session, thinking: mood === 'working', pendingRequestsCount: mood === 'waiting' ? 1 : 0 }]}
            connected={mood !== 'connecting'} onHide={() => setHidden(true)} />}
    </I18nProvider>
}

const root = createRootRoute({ component: Preview })
const machines = createRoute({ getParentRoute: () => root, path: '/settings/machines', component: () => null })
const router = createRouter({ routeTree: root.addChildren([machines]), history: createMemoryHistory({ initialEntries: ['/'] }) })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
