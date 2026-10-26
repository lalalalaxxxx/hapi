import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Machine } from '@/types/api'
import { RunnerPet } from './index'

const voice = vi.hoisted(() => ({ interaction: vi.fn(), drag: vi.fn(), celebrate: vi.fn(), bored: vi.fn() }))
const position = vi.hoisted(() => ({ dragging: false }))
vi.mock('./useRunnerPetVoice', () => ({ useRunnerPetVoice: () => voice }))
vi.mock('./useRunnerPetRoaming', () => ({ useRunnerPetRoaming: () => ({ motion: null, facingLeft: false }) }))
vi.mock('./useRunnerPetPosition', () => ({ useRunnerPetPosition: () => ({
    dragging: position.dragging, style: { visibility: 'visible' }, handlers: {}, consumeDragClick: () => false,
}) }))
vi.mock('@/lib/use-translation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@tanstack/react-router', () => ({ Link: (props: { children: React.ReactNode }) => <a>{props.children}</a> }))

const machine: Machine = { id: 'runner', namespace: 'default', active: true, activeAt: 0, seq: 0,
    createdAt: 0, updatedAt: 0, metadata: null, metadataVersion: 0, runnerStateVersion: 0,
    runnerState: { status: 'running' } }
const props = { machines: [machine], sessions: [], connected: true, onHide: () => {} }

describe('pet voice interaction scheduling', () => {
    beforeEach(() => {
        vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear()
        position.dragging = false
        window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    afterEach(() => vi.useRealTimers())
    it('plays the drag line once when picked up, separately from tapping', () => {
        const { rerender } = render(<RunnerPet {...props} />)
        position.dragging = true
        rerender(<RunnerPet {...props} />)
        rerender(<RunnerPet {...props} />)
        expect(voice.drag).toHaveBeenCalledOnce()
        expect(voice.interaction).not.toHaveBeenCalled()
    })
    it('calls once per minute while bored, and stops on disconnect', () => {
        const { rerender } = render(<RunnerPet {...props} />)
        act(() => vi.advanceTimersByTime(45_000))
        act(() => vi.advanceTimersByTime(59_999))
        expect(voice.bored).not.toHaveBeenCalled()
        act(() => vi.advanceTimersByTime(1))
        expect(voice.bored).toHaveBeenCalledOnce()
        act(() => vi.advanceTimersByTime(60_000))
        expect(voice.bored).toHaveBeenCalledTimes(2)
        rerender(<RunnerPet {...props} connected={false} />)
        act(() => vi.advanceTimersByTime(120_000))
        expect(voice.bored).toHaveBeenCalledTimes(2)
    })
    it('keeps the click detail panel and cancels boredom after interaction', () => {
        render(<RunnerPet {...props} />)
        act(() => vi.advanceTimersByTime(45_000))
        act(() => vi.advanceTimersByTime(59_000))
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.character.loopy/ }))
        expect(voice.interaction).toHaveBeenCalledOnce()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        act(() => vi.advanceTimersByTime(1000))
        expect(voice.bored).not.toHaveBeenCalled()
    })
    it('persists the voice switch and cancels reminders when muted', () => {
        render(<RunnerPet {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /runner.pet.character.loopy/ }))
        const toggle = screen.getByRole('switch', { name: 'runner.pet.voice' })
        expect(toggle).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-checked', 'false')
        expect(localStorage.getItem('hapi-runner-pet-voice-enabled')).toBe('false')
        act(() => vi.advanceTimersByTime(4000))
        act(() => vi.advanceTimersByTime(45_000))
        act(() => vi.advanceTimersByTime(120_000))
        expect(voice.bored).not.toHaveBeenCalled()
    })
})
