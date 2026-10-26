import { useEffect, useState } from 'react'
import { runnerPetAsset, type RunnerPetAnimation } from './animations'
import { DEFAULT_RUNNER_PET, RUNNER_PETS, type RunnerPetType } from './catalog'
import { useRunnerPetMotion } from './useRunnerPetMotion'

export function RunnerPetSprite(props: { animation: RunnerPetAnimation; paused?: boolean; pet?: RunnerPetType; motion?: 'system' | 'always' }) {
    const pet = props.pet ?? DEFAULT_RUNNER_PET
    const animated = useRunnerPetMotion(props.motion ?? 'system')
    const source = runnerPetAsset(props.animation, props.paused || !animated, pet)
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
        for (const state of ['tap', 'happy', 'drag', 'walk', 'jump', 'land', 'fall'] as const) new Image().src = runnerPetAsset(state, false, pet)
    }, [pet])
    return (
        <span className="runner-pet-sprite" aria-hidden="true" data-animation={props.animation}
            data-ready={shown === source || undefined} style={{ aspectRatio: RUNNER_PETS[pet].aspectRatio }}>
            {shown && <img src={shown} alt="" draggable={false} className="runner-pet-image" />}
        </span>
    )
}
