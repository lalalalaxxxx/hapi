import { useTranslation } from '@/lib/use-translation'
import { useRunnerPetSettings } from '@/hooks/useRunnerPetSettings'
import { SettingsChoiceGroup, SettingsSwitch } from '@/components/settings/SettingsPrimitives'
import { RUNNER_PETS, type RunnerPetType } from './catalog'
import { runnerPetAsset } from './animations'

export function RunnerPetSettings() {
    const { t } = useTranslation()
    const { pet, roaming, motion, updateRunnerPetSettings } = useRunnerPetSettings()
    return <>
        <div className="px-3 py-3">
            <p className="mb-2 text-sm font-medium">{t('runner.pet.choose')}</p>
            <div role="radiogroup" aria-label={t('runner.pet.choose')} className="grid grid-cols-2 gap-3">
                {(Object.keys(RUNNER_PETS) as RunnerPetType[]).map(id => <label key={id}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-sm focus-within:outline-2 focus-within:outline-[var(--app-link)] ${pet === id
                        ? 'border-[var(--app-link)] bg-[var(--app-subtle-bg)] text-[var(--app-link)]'
                        : 'border-[var(--app-border)] text-[var(--app-fg)]'}`}>
                    <input type="radio" name="runner-pet-character" value={id} checked={pet === id}
                        className="sr-only" onChange={() => updateRunnerPetSettings({ pet: id })} />
                    <img src={runnerPetAsset('idle', true, id)} alt="" className="h-24 w-24 object-contain" draggable={false} />
                    {t(RUNNER_PETS[id].name)}
                </label>)}
            </div>
        </div>
        <SettingsSwitch label={t('runner.pet.roaming')} description={t('runner.pet.roamingDescription')}
            checked={roaming} onChange={value => updateRunnerPetSettings({ roaming: value })} />
        <SettingsChoiceGroup label={t('runner.pet.motion')} value={motion}
            options={[{ value: 'system', label: t('runner.pet.motion.system') }, { value: 'always', label: t('runner.pet.motion.always') }]}
            onChange={value => updateRunnerPetSettings({ motion: value as 'system' | 'always' })} />
    </>
}
