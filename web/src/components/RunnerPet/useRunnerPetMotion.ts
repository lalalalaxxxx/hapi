import { useSyncExternalStore } from 'react'
const query = '(prefers-reduced-motion: reduce)'
function subscribe(listener: () => void) {
    const media = window.matchMedia(query)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
}
export function useRunnerPetMotion(mode: 'system' | 'always') {
    const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true)
    return mode === 'always' || !reduced
}
