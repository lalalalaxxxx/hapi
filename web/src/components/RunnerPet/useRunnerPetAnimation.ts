import { useCallback, useEffect, useRef, useState } from 'react'
import type { Machine, SessionSummary } from '@/types/api'
import type { RunnerPetMood } from '@/lib/runnerPet'
import { onRunnerPetCompletion } from '@/lib/runnerPetEvents'
import {
    RUNNER_PET_ANIMATIONS,
    RUNNER_PET_BORED_AFTER_MS,
    RUNNER_PET_CELEBRATE_MS,
    type RunnerPetAnimation,
} from './animations'

export function useRunnerPetAnimation(options: {
    mood: RunnerPetMood
    machineId: string
    machines: Machine[]
    sessions: SessionSummary[]
    visible: boolean
    onCelebrate?: () => void
}) {
    const [reaction, setReaction] = useState<RunnerPetAnimation | null>(null)
    const [bored, setBored] = useState(false)
    const [interaction, setInteraction] = useState(0)
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])
    const current = useRef(options)
    current.current = options

    const clearReactionTimers = useCallback(() => {
        for (const timer of timers.current) clearTimeout(timer)
        timers.current = []
    }, [])

    useEffect(() => clearReactionTimers, [clearReactionTimers])

    // Never replay a previous machine's celebration or a hidden-tab interaction.
    useEffect(() => {
        clearReactionTimers()
        setReaction(null)
        setBored(false)
    }, [options.machineId, options.visible, clearReactionTimers])

    useEffect(() => {
        if (options.mood === 'connecting' || options.mood === 'offline') {
            clearReactionTimers()
            setReaction(null)
        }
    }, [options.mood, clearReactionTimers])

    useEffect(() => {
        setBored(false)
        if (!options.visible || options.mood !== 'idle' || reaction) return
        const timeout = setTimeout(() => setBored(true), RUNNER_PET_BORED_AFTER_MS)
        return () => clearTimeout(timeout)
    }, [options.mood, options.visible, options.machineId, reaction, interaction])

    const interact = useCallback(() => {
        if (!current.current.visible) return
        clearReactionTimers()
        setBored(false)
        setInteraction(value => value + 1)
        setReaction('tap')
        timers.current.push(setTimeout(() => {
            setReaction('happy')
            timers.current.push(setTimeout(() => {
                setReaction(null)
                timers.current = []
            }, RUNNER_PET_ANIMATIONS.happy.duration))
        }, RUNNER_PET_ANIMATIONS.tap.duration))
    }, [clearReactionTimers])

    useEffect(() => onRunnerPetCompletion(sessionId => {
        const snapshot = current.current
        if (!snapshot.visible || snapshot.mood === 'connecting' || snapshot.mood === 'offline'
            || snapshot.mood === 'waiting') return
        const session = snapshot.sessions.find(item => item.id === sessionId)
        const machineId = session?.metadata?.machineId
        if (!session?.active || session.pendingRequestsCount > 0 || !machineId
            || (snapshot.machineId && snapshot.machineId !== machineId)) return
        if (!snapshot.machines.some(machine => machine.id === machineId && machine.active
            && machine.runnerState?.status !== 'shutting-down')) return
        clearReactionTimers()
        setBored(false)
        setReaction('celebrate')
        snapshot.onCelebrate?.()
        timers.current.push(setTimeout(() => {
            setReaction(null)
            timers.current = []
        }, RUNNER_PET_CELEBRATE_MS))
    }), [clearReactionTimers])

    const animation: RunnerPetAnimation = reaction
        ?? (options.mood === 'connecting' ? 'waiting' : bored && options.mood === 'idle' ? 'bored' : options.mood)
    return { animation, interact }
}
