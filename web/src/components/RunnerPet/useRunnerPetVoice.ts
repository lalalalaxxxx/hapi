import { useCallback, useEffect, useRef } from 'react'
import { PetVoicePlayer } from './voicePlayer'
import type { RunnerPetType } from './catalog'

export function useRunnerPetVoice(options: {
    enabled: boolean
    visible: boolean
    machineId: string
    pet: RunnerPetType
}) {
    const player = useRef<PetVoicePlayer | null>(null)
    const current = useRef(options)
    current.current = options
    const canPlay = () => current.current.enabled && current.current.visible
        && document.visibilityState === 'visible' && document.hasFocus()

    useEffect(() => {
        if (!options.enabled) return
        const audio = new PetVoicePlayer(options.pet)
        player.current = audio
        return () => { audio.dispose(); player.current = null }
    }, [options.enabled, options.pet])

    useEffect(() => {
        if (!options.visible || !options.enabled) return
        const unlock = (event: Event) => { if (event.isTrusted && canPlay()) player.current?.unlock() }
        const stop = () => player.current?.stop()
        const onVisibility = () => { if (document.visibilityState !== 'visible') stop() }
        // Pointerdown covers mouse; pointerup/touchend allow mobile audio unlock.
        const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const
        gestures.forEach(type => document.addEventListener(type, unlock, true))
        window.addEventListener('blur', stop)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            gestures.forEach(type => document.removeEventListener(type, unlock, true))
            window.removeEventListener('blur', stop)
            document.removeEventListener('visibilitychange', onVisibility)
            stop()
        }
    }, [options.enabled, options.visible])

    useEffect(() => { player.current?.stop() }, [options.machineId])

    const interaction = useCallback(() => {
        if (canPlay()) player.current?.play('interact')
    }, [])
    const celebrate = useCallback(() => {
        if (canPlay()) player.current?.play('celebrate')
    }, [])
    const drag = useCallback(() => {
        if (canPlay()) player.current?.play('drag')
    }, [])
    const bored = useCallback(() => {
        if (canPlay()) player.current?.play('bored')
    }, [])
    return { interaction, drag, celebrate, bored }
}
