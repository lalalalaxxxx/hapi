import { useEffect, useState, useSyncExternalStore } from 'react'
import { runnerPetAsset, type RunnerPetAnimation } from './animations'

const query = '(prefers-reduced-motion: reduce)'
function subscribe(listener: () => void) {
    const media = window.matchMedia(query)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
}
const snapshot = () => window.matchMedia(query).matches

export function RunnerPetSprite(props: { animation: RunnerPetAnimation; paused?: boolean }) {
    const reducedMotion = useSyncExternalStore(subscribe, snapshot, () => true)
    const source = runnerPetAsset(props.animation, props.paused || reducedMotion)
    const [shown, setShown] = useState('')
    useEffect(() => {
        let active = true
        const image = new Image()
        image.onload = () => { if (active) setShown(source) }
        image.src = source
        return () => { active = false; image.onload = null }
    }, [source])
    useEffect(() => {
        // Decode common reactions early so dragging/tapping never flashes a box.
        for (const state of ['tap', 'happy', 'drag'] as const) new Image().src = runnerPetAsset(state)
    }, [])
    return (
        <span className="runner-pet-sprite" aria-hidden="true" data-animation={props.animation}
            data-ready={shown === source || undefined}>
            {shown && <img src={shown} alt="" draggable={false} className="runner-pet-image" />}
        </span>
    )
}
