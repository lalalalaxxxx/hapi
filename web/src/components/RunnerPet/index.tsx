import { useEffect, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Link } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { getRunnerPetState } from '@/lib/runnerPet'
import { useMachines } from '@/hooks/queries/useMachines'
import { useSessions } from '@/hooks/queries/useSessions'
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility'
import { useRunnerPetPreference } from '@/hooks/useRunnerPetPreference'
import type { Machine, SessionSummary } from '@/types/api'
import { RunnerPetSprite } from './RunnerPetSprite'
import './runner-pet.css'

export function RunnerPet(props: {
    machines: Machine[]
    sessions: SessionSummary[]
    connected: boolean
    loading?: boolean
    hasError?: boolean
    onHide: () => void
}) {
    const { t } = useTranslation()
    const visible = useDocumentVisibility()
    const [machineId, setMachineId] = useState('')
    const [happy, setHappy] = useState(false)
    const [open, setOpen] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const selectedId = props.machines.some(machine => machine.id === machineId) ? machineId : ''
    const state = getRunnerPetState({ ...props, machineId: selectedId })
    const moodText = t(`runner.pet.state.${state.mood}`)
    const unknown = state.mood === 'connecting'

    useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])

    const pet = () => {
        if (timer.current !== null) clearTimeout(timer.current)
        setHappy(true)
        timer.current = setTimeout(() => { setHappy(false); timer.current = null }, 1200)
    }

    return (
        <div className="runner-pet" data-paused={!visible || undefined} data-mood={state.mood}>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button type="button" className="runner-pet-trigger" aria-label={`${t('runner.pet.title')}: ${moodText}`} title={t('runner.pet.open')}>
                        <RunnerPetSprite mood={state.mood} happy={happy} />
                        <span className="runner-pet-label">{moodText}</span>
                    </button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content side="top" align="end" sideOffset={12} collisionPadding={12}
                        className="runner-pet-panel" aria-label={t('runner.pet.title')}>
                        <div className="runner-pet-panel-heading">
                            <div><h2>{t('runner.pet.title')}</h2><p>{t('runner.pet.subtitle')}</p></div>
                            <Popover.Close className="runner-pet-close" aria-label={t('runner.pet.close')}>×</Popover.Close>
                        </div>
                        <div className="runner-pet-scene" data-mood={state.mood} data-paused={!visible || undefined}>
                            <span className="runner-pet-scene-dot runner-pet-scene-dot-a" aria-hidden="true" />
                            <span className="runner-pet-scene-dot runner-pet-scene-dot-b" aria-hidden="true" />
                            <button type="button" className="runner-pet-pat" onClick={pet} aria-label={t('runner.pet.pat')}>
                                <RunnerPetSprite mood={state.mood} happy={happy} />
                            </button>
                            <p role="status">{happy ? t('runner.pet.happy') : t(`runner.pet.message.${state.mood}`)}</p>
                        </div>
                        {props.machines.length > 1 && (
                            <label className="runner-pet-machine">
                                <span>{t('runner.pet.watch')}</span>
                                <select value={selectedId} onChange={(event) => setMachineId(event.target.value)}>
                                    <option value="">{t('runner.pet.all')}</option>
                                    {props.machines.map(machine => <option key={machine.id} value={machine.id}>
                                        {machine.metadata?.displayName || machine.metadata?.host || machine.id}
                                    </option>)}
                                </select>
                            </label>
                        )}
                        <dl className="runner-pet-stats">
                            <div><dt>{t('runner.pet.online')}</dt><dd>{unknown ? '—' : state.onlineCount}</dd></div>
                            <div><dt>{t('runner.pet.working')}</dt><dd>{unknown ? '—' : state.workingCount}</dd></div>
                            <div><dt>{t('runner.pet.waiting')}</dt><dd>{unknown ? '—' : state.waitingCount}</dd></div>
                        </dl>
                        <div className="runner-pet-actions">
                            <Link to="/settings/machines" onClick={() => setOpen(false)}>{t('runner.pet.runners')}</Link>
                            <button type="button" onClick={() => { setOpen(false); props.onHide() }}>{t('runner.pet.hide')}</button>
                        </div>
                        <p className="runner-pet-restore">{t('runner.pet.restore')}</p>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    )
}

function ConnectedRunnerPet(props: { connected: boolean; onHide: () => void }) {
    const { api, baseUrl } = useAppContext()
    const machines = useMachines(api, true)
    const sessions = useSessions(api)
    return <RunnerPet key={baseUrl} machines={machines.machines} sessions={sessions.sessions}
        connected={props.connected} loading={machines.isLoading || sessions.isLoading}
        hasError={Boolean(machines.error || sessions.error)} onHide={props.onHide} />
}

export function RunnerPetWidget(props: { connected: boolean; showOnMobile: boolean }) {
    const { runnerPetEnabled, setRunnerPetEnabled } = useRunnerPetPreference()
    return runnerPetEnabled
        ? <div className={props.showOnMobile ? undefined : 'runner-pet-desktop-only'}>
            <ConnectedRunnerPet connected={props.connected} onHide={() => setRunnerPetEnabled(false)} />
        </div>
        : null
}
