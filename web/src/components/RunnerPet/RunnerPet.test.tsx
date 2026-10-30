import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Machine } from '@/types/api'
import { RunnerPet } from './index'

vi.mock('@/lib/use-translation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const machine: Machine = { id: 'runner', namespace: 'default', active: true, activeAt: 0, seq: 0, createdAt: 0, updatedAt: 0,
    metadata: null, metadataVersion: 0, runnerState: { status: 'running' }, runnerStateVersion: 0 }

describe('Runner companion interactions', () => {
    afterEach(() => { vi.useRealTimers() })
    it('reacts to a click without opening a panel', () => {
        vi.useFakeTimers()
        const { container } = render(<RunnerPet machines={[machine]} sessions={[]} connected />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.character.loopy/ }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('button')).not.toHaveAttribute('aria-haspopup')
        expect(container.querySelector('[data-animation="tap"]')).toBeInTheDocument()
        act(() => { vi.advanceTimersByTime(4000) })
        expect(container.querySelector('[data-animation="idle"]')).toBeInTheDocument()
    })
    it('cleans up the interaction timer when unmounted', () => {
        vi.useFakeTimers()
        const clear = vi.spyOn(globalThis, 'clearTimeout')
        const view = render(<RunnerPet machines={[machine]} sessions={[]} connected />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.character.loopy/ }))
        clear.mockClear()
        view.unmount()
        expect(clear).toHaveBeenCalled()
        clear.mockRestore()
    })
    it('keeps the disconnected status accessible without opening a panel', () => {
        render(<RunnerPet machines={[machine]} sessions={[]} connected={false} />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.state.connecting/ }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('button')).toHaveAccessibleName(/runner.pet.state.connecting/)
    })
})
