import { useSyncExternalStore } from 'react'

const KEY = 'hapi-runner-pet-enabled'
const listeners = new Set<() => void>()
let fallback = true
let memoryOnly = false

function getSnapshot(): boolean {
    if (memoryOnly) return fallback
    try { return localStorage.getItem(KEY) !== 'false' } catch { return fallback }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
        if (event.key === KEY || event.key === null) { memoryOnly = false; listener() }
    }
    window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
    }
}

function setRunnerPetEnabled(enabled: boolean): void {
    fallback = enabled
    try { localStorage.setItem(KEY, String(enabled)); memoryOnly = false } catch { memoryOnly = true }
    for (const listener of listeners) listener()
}

export function useRunnerPetPreference() {
    const runnerPetEnabled = useSyncExternalStore(subscribe, getSnapshot, () => true)
    return { runnerPetEnabled, setRunnerPetEnabled }
}
