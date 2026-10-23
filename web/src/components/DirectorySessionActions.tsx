import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, type ApiClient } from '@/api/client'
import type { SessionSummary } from '@/types/api'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clearMessageWindow } from '@/lib/message-window-store'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'

export type DirectoryAction = {
    kind: 'cleanup' | 'delete'
    directory: string
    sessions: SessionSummary[]
}

export function DirectoryActionButtons(props: { onAction: (kind: DirectoryAction['kind']) => void }) {
    const { t } = useTranslation()
    return <>
        {(['cleanup', 'delete'] as const).map(kind => (
            <button
                key={kind}
                type="button"
                className="shrink-0 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                title={t(`sessions.directory.${kind}`)}
                aria-label={t(`sessions.directory.${kind}`)}
                onClick={event => { event.stopPropagation(); props.onAction(kind) }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    {kind === 'delete'
                        ? <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>
                        : <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></>}
                </svg>
            </button>
        ))}
    </>
}

// Mounted outside the directory headers: filtering/deleting the last visible
// row must not dismiss a running batch or hide errors for other rows.
export function DirectoryActionDialog(props: {
    action: DirectoryAction
    api: ApiClient
    onClose: () => void
    onComplete?: (result: { stopped: number; skipped: number }) => void
}) {
    const { action, api } = props
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [pending, setPending] = useState(false)
    const [processed, setProcessed] = useState(0)
    const completed = useRef(new Set<string>())
    const cleanupResult = useRef({ stopped: 0, skipped: 0 })
    const running = useRef(false)
    const deleting = action.kind === 'delete'

    const confirm = async () => {
        if (running.current) return
        running.current = true
        setPending(true)
        const failures: string[] = []
        try {
            for (const session of action.sessions) {
                if (completed.current.has(session.id)) continue
                try {
                    if (deleting) {
                        await api.deleteSession(session.id, { stop: true })
                    } else {
                        const stopped = await api.archiveIdleSession(session.id)
                        cleanupResult.current[stopped ? 'stopped' : 'skipped']++
                    }
                    completed.current.add(session.id)
                } catch (error) {
                    if (error instanceof ApiError && error.status === 404) {
                        completed.current.add(session.id)
                        if (!deleting) cleanupResult.current.skipped++
                    } else {
                        failures.push(`${session.metadata?.name ?? session.id}: ${error instanceof Error ? error.message : String(error)}`)
                        continue
                    }
                }
                if (deleting) {
                    queryClient.removeQueries({ queryKey: queryKeys.session(session.id) })
                    clearMessageWindow(session.id)
                } else {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.session(session.id) })
                }
                setProcessed(completed.current.size)
            }
        } finally {
            void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
            running.current = false
            setPending(false)
        }
        if (failures.length) {
            throw new Error(t('sessions.directory.failed', { count: failures.length }) + '\n' + failures.slice(0, 3).join('\n'))
        }
        props.onComplete?.(cleanupResult.current)
    }

    return <ConfirmDialog
        isOpen
        onClose={() => { if (!running.current) props.onClose() }}
        title={t(`sessions.directory.${action.kind}`)}
        description={t(`sessions.directory.${action.kind}Description`, { path: action.directory, count: action.sessions.length })}
        confirmLabel={t(`sessions.directory.${action.kind}Confirm`)}
        confirmingLabel={t('sessions.directory.progress', { done: processed, total: action.sessions.length })}
        onConfirm={confirm}
        isPending={pending}
        destructive={deleting}
    />
}
