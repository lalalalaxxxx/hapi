import { useCallback, useEffect, useRef, useState } from 'react'
import { BOBO_DANCES, BoboDancePlayer, DANCE_DURATION, type DancePlayback } from './dancePlayer'

export function useRunnerPetDance(options: { enabled: boolean; available: boolean; sound: boolean; machineId: string }) {
    const [playback, setPlayback] = useState<DancePlayback | null>(null)
    const [busy, setBusy] = useState(false)
    const active = useRef(false)
    const generation = useRef(0)
    const player = useRef<BoboDancePlayer | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const current = useRef(options)
    current.current = options
    const cancel = useCallback(() => {
        generation.current++
        player.current?.stop()
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        active.current = false
        setPlayback(null)
        setBusy(false)
    }, [])

    useEffect(() => {
        if (!options.enabled) return
        const instance = new BoboDancePlayer()
        player.current = instance
        return () => { cancel(); instance.dispose(); player.current = null }
    }, [options.enabled, cancel])
    useEffect(() => { cancel() }, [options.machineId, cancel])
    useEffect(() => { if (!options.available) cancel() }, [options.available, cancel])
    useEffect(() => {
        if (!options.sound) { cancel() }
    }, [options.sound, cancel])
    useEffect(() => {
        const hidden = () => { if (document.visibilityState !== 'visible') cancel() }
        window.addEventListener('blur', cancel)
        document.addEventListener('visibilitychange', hidden)
        return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden) }
    }, [cancel])

    const start = useCallback(async () => {
        if (active.current || !current.current.enabled || !current.current.available || !player.current
            || document.visibilityState !== 'visible' || !document.hasFocus()) return
        active.current = true
        setBusy(true)
        const id = BOBO_DANCES[Math.min(BOBO_DANCES.length - 1, Math.floor(Math.random() * BOBO_DANCES.length))]
        const instance = player.current
        const request = ++generation.current
        const result = await instance.play(id, current.current.sound)
        if (player.current !== instance || request !== generation.current || !active.current) return
        if (!result) { cancel(); return }
        setPlayback(result)
        timer.current = setTimeout(cancel, Math.max(0, DANCE_DURATION - (performance.now() - result.startedAt)))
    }, [cancel])

    return { playback, busy, start, cancel }
}
