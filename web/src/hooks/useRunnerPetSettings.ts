import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_RUNNER_PET, isRunnerPetType, type RunnerPetType } from '@/components/RunnerPet/catalog'

export type RunnerPetSettings = { pet: RunnerPetType; roaming: boolean; motion: 'system' | 'always' }
const defaults: RunnerPetSettings = { pet: DEFAULT_RUNNER_PET, roaming: true, motion: 'system' }
const KEY = 'hapi-runner-pet-settings'
const listeners = new Set<() => void>()
let memory: string | null = null
let memoryOnly = false

function snapshot() {
    if (memoryOnly) return memory
    try { return localStorage.getItem(KEY) } catch { return memory }
}
function parse(raw: string | null): RunnerPetSettings {
    try {
        const value = JSON.parse(raw ?? 'null') as Partial<RunnerPetSettings> | null
        return { pet: isRunnerPetType(value?.pet) ? value.pet : defaults.pet,
            roaming: typeof value?.roaming === 'boolean' ? value.roaming : defaults.roaming,
            motion: value?.motion === 'always' ? 'always' : 'system' }
    } catch { return defaults }
}
function subscribe(listener: () => void) {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
        if (event.key === KEY || event.key === null) { memoryOnly = false; listener() }
    }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}
function updateRunnerPetSettings(update: Partial<RunnerPetSettings>) {
    memory = JSON.stringify({ ...parse(snapshot()), ...update })
    try { localStorage.setItem(KEY, memory); memoryOnly = false } catch { memoryOnly = true }
    listeners.forEach(listener => listener())
}
export function useRunnerPetSettings() {
    const raw = useSyncExternalStore(subscribe, snapshot, () => null)
    const settings = useMemo(() => parse(raw), [raw])
    return { ...settings, updateRunnerPetSettings }
}
