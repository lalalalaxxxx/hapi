import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Machine } from '@/types/api'
import { RunnerPet } from './index'

vi.mock('@/lib/use-translation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@tanstack/react-router', () => ({ Link: (props: { children: React.ReactNode; to: string; onClick?: () => void }) => <a href={props.to} onClick={props.onClick}>{props.children}</a> }))

const machine: Machine = { id: 'runner', namespace: 'default', active: true, activeAt: 0, seq: 0, createdAt: 0, updatedAt: 0,
    metadata: null, metadataVersion: 0, runnerState: { status: 'running' }, runnerStateVersion: 0 }

describe('Runner companion interactions', () => {
    afterEach(() => { vi.useRealTimers() })
    it('opens an accessible panel, reacts to a pat, and can be hidden', () => {
        vi.useFakeTimers()
        const hide = vi.fn()
        render(<RunnerPet machines={[machine]} sessions={[]} connected onHide={hide} />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.title/ }))
        expect(screen.getByRole('dialog', { name: 'runner.pet.title' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'runner.pet.pat' }))
        expect(screen.getByRole('status')).toHaveTextContent('runner.pet.happy')
        act(() => { vi.advanceTimersByTime(4000) })
        expect(screen.getByRole('status')).toHaveTextContent('runner.pet.message.idle')
        fireEvent.click(screen.getByRole('button', { name: 'runner.pet.hide' }))
        expect(hide).toHaveBeenCalledOnce()
    })
    it('cleans up the interaction timer when unmounted', () => {
        vi.useFakeTimers()
        const clear = vi.spyOn(globalThis, 'clearTimeout')
        const view = render(<RunnerPet machines={[machine]} sessions={[]} connected onHide={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.title/ }))
        fireEvent.click(screen.getByRole('button', { name: 'runner.pet.pat' }))
        clear.mockClear()
        view.unmount()
        expect(clear).toHaveBeenCalled()
        clear.mockRestore()
    })
    it('uses unknown status rather than stale online counts after disconnect', () => {
        render(<RunnerPet machines={[machine]} sessions={[]} connected={false} onHide={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.state.connecting/ }))
        expect(screen.getAllByText('—')).toHaveLength(3)
    })
})
