import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { I18nProvider } from '../src/lib/i18n-context'
import { RunnerPet } from '../src/components/RunnerPet'
import { RunnerPetSettings } from '../src/components/RunnerPet/RunnerPetSettings'
import { getUserBubbleClassName, UserBubbleContent } from '../src/components/AssistantChat/messages/user-bubble'
import { notifyRunnerPetToast } from '../src/lib/runnerPetEvents'
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
    const [chat, setChat] = useState(new URLSearchParams(location.search).has('physics'))
    const [physics, setPhysics] = useState(new URLSearchParams(location.search).has('physics'))
    const [messages, setMessages] = useState([1, 2, 3, 4, 5, 6])
    const [expanded, setExpanded] = useState(false)
    return <I18nProvider>
        <main style={{ minHeight: '100dvh', padding: 'clamp(24px, 6vw, 80px)', background: 'var(--app-bg)', color: 'var(--app-fg)' }}>
            <p style={{ color: 'var(--app-hint)', fontSize: 12, letterSpacing: 3 }}>HAPI / RUNNER COMPANION</p>
            <h1 style={{ fontSize: physics ? 24 : 'clamp(24px, 4vw, 40px)', fontWeight: 650, margin: '20px 0 12px' }}>你认真创造，{!physics && <br />}我负责陪伴。</h1>
            <p style={{ color: 'var(--app-hint)', fontSize: 14 }}>点一点角落里的小伙伴，和它互动。</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28, maxWidth: 390 }}>
                {Object.entries({ idle: '准备好了', working: '忙碌中', waiting: '等你回应', offline: '休息中', connecting: '连接中' }).map(([value, label]) =>
                    <button key={value} onClick={() => setMood(value)} style={{ border: '1px solid var(--app-border)', borderRadius: 20, padding: '8px 14px', fontSize: 12,
                        background: value === mood ? 'var(--app-fg)' : 'var(--app-bg)', color: value === mood ? 'var(--app-bg)' : 'var(--app-fg)' }}>{label}</button>)}
                <button onClick={() => notifyRunnerPetToast({ title: 'Task completed', sessionId: session.id })}>完成任务</button>
                <button onClick={() => setChat(value => !value)}>切换会话输入框</button>
                <button onClick={() => setExpanded(value => !value)}>展开输入框</button>
                <button onClick={() => { setPhysics(value => !value); setChat(true) }}>切换消息场景</button>
                {physics && <button onClick={() => {
                    const support = document.querySelector('.runner-pet')?.getAttribute('data-support')
                    setMessages(values => values.filter(id => `preview-message-${id}` !== support))
                }}>移除脚下消息</button>}
                <button onClick={() => setHidden(value => !value)}>{hidden ? '叫小伙伴回来' : '隐藏小伙伴'}</button>
            </div>
            <p style={{ color: 'var(--app-hint)', fontSize: 11, marginTop: 18 }}>交互预览 · 使用模拟状态</p>
            <details style={{ maxWidth: 390, marginTop: 24 }}>
                <summary style={{ cursor: 'pointer' }}>宠物设置</summary>
                <RunnerPetSettings />
            </details>
        </main>
        {physics && <div data-runner-pet-world data-testid="preview-thread" style={{ position: 'fixed', top: 310,
            bottom: expanded ? 358 : 168, left: 'max(12px, 12vw)', right: 'max(12px, 12vw)', overflow: 'auto',
            borderTop: '1px solid var(--app-border)', padding: '110px 16px 30px', background: 'var(--app-bg)' }}>
            {messages.map(id => <div key={id} data-runner-pet-surface={`preview-message-${id}`}
                className={getUserBubbleClassName()} style={{ width: 'min(85%, 360px)', marginBottom: 140,
                    marginLeft: id % 2 ? 'auto' : 0, marginRight: id % 2 ? 0 : 'auto' }}>
                <UserBubbleContent text={['站在消息上休息一下。', '可以从上面的消息跳到这里。', '滚动页面，看看小宠物会怎么走。'][(id - 1) % 3]} />
            </div>)}
        </div>}
        {chat && <div data-runner-pet-avoid data-testid="preview-composer" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
            height: expanded ? 350 : 160, padding: 16, background: 'var(--app-bg)', borderTop: '1px solid var(--app-border)' }}>
            <textarea aria-label="消息输入框" style={{ width: '100%', height: '100%', resize: 'none' }} />
        </div>}
        {!hidden && <RunnerPet machines={[{ ...machine, active: mood !== 'offline' }]} sessions={[{ ...session, thinking: mood === 'working', pendingRequestsCount: mood === 'waiting' ? 1 : 0 }]}
            connected={mood !== 'connecting'} />}
    </I18nProvider>
}

const root = createRootRoute({ component: Preview })
const machines = createRoute({ getParentRoute: () => root, path: '/settings/machines', component: () => null })
const router = createRouter({ routeTree: root.addChildren([machines]), history: createMemoryHistory({ initialEntries: ['/'] }) })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
