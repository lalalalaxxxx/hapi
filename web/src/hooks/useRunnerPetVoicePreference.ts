import { useSyncExternalStore } from 'react'

const KEY = 'hapi-runner-pet-voice-enabled'
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

function setRunnerPetVoiceEnabled(enabled: boolean): void {
    fallback = enabled
    try { localStorage.setItem(KEY, String(enabled)); memoryOnly = false } catch { memoryOnly = true }
    for (const listener of listeners) listener()
}

export function useRunnerPetVoicePreference() {
    const runnerPetVoiceEnabled = useSyncExternalStore(subscribe, getSnapshot, () => true)
    return { runnerPetVoiceEnabled, setRunnerPetVoiceEnabled }
}
