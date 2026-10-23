import type { Machine, SessionSummary } from '@/types/api'

export type RunnerPetMood = 'connecting' | 'offline' | 'waiting' | 'working' | 'idle'

export function getRunnerPetState(options: {
    machines: Machine[]
    sessions: SessionSummary[]
    connected: boolean
    loading?: boolean
    hasError?: boolean
    machineId?: string
}) {
    const machines = options.machineId
        ? options.machines.filter(machine => machine.id === options.machineId)
        : options.machines
    const online = machines.filter(machine => machine.active && machine.runnerState?.status !== 'shutting-down')
    const onlineIds = new Set(online.map(machine => machine.id))
    // Stale or standalone CLI sessions must not make an offline Runner look busy.
    const sessions = options.sessions.filter(session => session.active
        && Boolean(session.metadata?.machineId && onlineIds.has(session.metadata.machineId)))
    const waiting = sessions.filter(session => session.pendingRequestsCount > 0)
    const working = sessions.filter(session => session.thinking || session.backgroundTaskCount > 0)
    let mood: RunnerPetMood = 'idle'
    if (!options.connected || options.loading || options.hasError) mood = 'connecting'
    else if (online.length === 0) mood = 'offline'
    else if (waiting.length > 0) mood = 'waiting'
    else if (working.length > 0) mood = 'working'
    return { mood, onlineCount: online.length, workingCount: working.length, waitingCount: waiting.length }
}
