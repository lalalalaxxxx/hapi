import { DEFAULT_RUNNER_PET, RUNNER_PETS, type RunnerPetType } from './catalog'

export const RUNNER_PET_ANIMATIONS = {
    idle: { duration: 2000 },
    tap: { duration: 2000 },
    happy: { duration: 2000 },
    bored: { duration: 2000 },
    celebrate: { duration: 2000 },
    working: { duration: 2000 },
    waiting: { duration: 2000 },
    offline: { duration: 2000 },
    drag: { duration: 2000 },
    walk: { duration: 1400 },
    jump: { duration: 1000 },
    land: { duration: 320 },
    fall: { duration: 1000 },
} as const

export type RunnerPetAnimation = keyof typeof RUNNER_PET_ANIMATIONS
export const RUNNER_PET_BORED_AFTER_MS = 45_000
export const RUNNER_PET_CELEBRATE_MS = 2000

export function runnerPetAsset(animation: RunnerPetAnimation, still = false, pet: RunnerPetType = DEFAULT_RUNNER_PET): string {
    // The original character keeps its approved artwork while gaining continuous movement.
    const source = pet === 'companion'
        ? ({ walk: 'working', jump: 'happy', land: 'tap', fall: 'drag' } as Partial<Record<RunnerPetAnimation, string>>)[animation] ?? animation
        : !still && (animation === 'idle' || animation === 'working') ? `${animation}-stable` : animation
    return `${import.meta.env.BASE_URL}pets/${RUNNER_PETS[pet].assets}/${still ? 'static/' : ''}${source}.webp`
}
