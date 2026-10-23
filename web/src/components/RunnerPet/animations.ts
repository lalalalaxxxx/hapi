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
} as const

export type RunnerPetAnimation = keyof typeof RUNNER_PET_ANIMATIONS
export const RUNNER_PET_BORED_AFTER_MS = 45_000
export const RUNNER_PET_CELEBRATE_MS = 2000

export function runnerPetAsset(animation: RunnerPetAnimation, still = false): string {
    return `${import.meta.env.BASE_URL}pets/runner-v2/${still ? 'static/' : ''}${animation}.webp`
}
