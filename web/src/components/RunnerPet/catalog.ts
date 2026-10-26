export const RUNNER_PETS = {
    companion: { name: 'runner.pet.character.companion', aspectRatio: 2 / 3, assets: 'runner-v2' },
    loopy: { name: 'runner.pet.character.loopy', aspectRatio: 1, assets: 'loopy-v1' },
} as const

export type RunnerPetType = keyof typeof RUNNER_PETS
export const DEFAULT_RUNNER_PET: RunnerPetType = 'loopy'
export function isRunnerPetType(value: unknown): value is RunnerPetType {
    return value === 'companion' || value === 'loopy'
}
