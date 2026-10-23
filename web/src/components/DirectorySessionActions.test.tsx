import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import type { SessionSummary } from '@/types/api'
import { I18nProvider } from '@/lib/i18n-context'
import { DirectoryActionDialog, type DirectoryAction } from './DirectorySessionActions'

afterEach(cleanup)

function mount(api: Partial<ApiClient>, kind: DirectoryAction['kind'] = 'delete') {
    const onClose = vi.fn()
    const onComplete = vi.fn()
    const action: DirectoryAction = { kind, directory: '/project', sessions: [
        { id: 'one', metadata: { path: '/project', name: 'One' } },
        { id: 'two', metadata: { path: '/project', name: 'Two' } }
    ] as SessionSummary[] }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><I18nProvider>
        <DirectoryActionDialog api={api as ApiClient} action={action} onClose={onClose} onComplete={onComplete} />
    </I18nProvider></QueryClientProvider>)
    return { onClose, onComplete }
}

describe('directory session actions', () => {
    it('reports partial failure and retries only failed sessions', async () => {
        const remove = vi.fn(async (id: string) => { if (id === 'one') throw new Error('Runner offline') })
        const { onClose } = mount({ deleteSession: remove })
        fireEvent.click(screen.getByRole('button', { name: 'Delete directory sessions' }))
        await screen.findByText(/1 sessions could not be processed/)
        expect(remove.mock.calls).toEqual([['one', { stop: true }], ['two', { stop: true }]])
        expect(onClose).not.toHaveBeenCalled()
        remove.mockResolvedValue(undefined)
        fireEvent.click(screen.getByRole('button', { name: 'Delete directory sessions' }))
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        expect(remove.mock.calls).toEqual([['one', { stop: true }], ['two', { stop: true }], ['one', { stop: true }]])
    })

    it('uses guarded idle cleanup and keeps conversation records', async () => {
        const archive = vi.fn(async (id: string) => id === 'one')
        const remove = vi.fn()
        const { onClose, onComplete } = mount({ archiveIdleSession: archive, deleteSession: remove }, 'cleanup')
        fireEvent.click(screen.getByRole('button', { name: 'Clean up' }))
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        expect(archive.mock.calls).toEqual([['one'], ['two']])
        expect(remove).not.toHaveBeenCalled()
        expect(onComplete).toHaveBeenCalledWith({ stopped: 1, skipped: 1 })
    })

    it('does not start a second batch or dismiss while termination is pending', async () => {
        let finish!: () => void
        const gate = new Promise<void>(resolve => { finish = resolve })
        const remove = vi.fn(() => gate)
        const { onClose } = mount({ deleteSession: remove })
        const confirm = screen.getByRole('button', { name: 'Delete directory sessions' })
        fireEvent.click(confirm)
        fireEvent.click(confirm)
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        expect(onClose).not.toHaveBeenCalled()
        expect(remove).toHaveBeenCalledTimes(1)
        finish()
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    })
})
