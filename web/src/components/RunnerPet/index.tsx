import { useEffect, useState } from 'react'
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
import { useRunnerPetAnimation } from './useRunnerPetAnimation'
import { useRunnerPetPosition } from './useRunnerPetPosition'
import { useRunnerPetVoicePreference } from '@/hooks/useRunnerPetVoicePreference'
import { useRunnerPetVoice } from './useRunnerPetVoice'
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
    const [open, setOpen] = useState(false)
    const position = useRunnerPetPosition()
    useEffect(() => { if (position.dragging) setOpen(false) }, [position.dragging])
    const selectedId = props.machines.some(machine => machine.id === machineId) ? machineId : ''
    const state = getRunnerPetState({ ...props, machineId: selectedId })
    const moodText = t(`runner.pet.state.${state.mood}`)
    const unknown = state.mood === 'connecting'
    const { runnerPetVoiceEnabled, setRunnerPetVoiceEnabled } = useRunnerPetVoicePreference()
    const voiceVisible = visible && position.style.visibility !== 'hidden'
    const voice = useRunnerPetVoice({ enabled: runnerPetVoiceEnabled, visible: voiceVisible, machineId: selectedId })
    const { animation, interact: animateInteraction } = useRunnerPetAnimation({
        ...props, mood: state.mood, machineId: selectedId, visible, onCelebrate: voice.celebrate,
    })
    const interact = () => { animateInteraction(); voice.interaction() }
    useEffect(() => { if (position.dragging) voice.interaction() }, [position.dragging, voice.interaction])
    useEffect(() => {
        if (!runnerPetVoiceEnabled || !voiceVisible || position.dragging || animation !== 'bored' || state.mood !== 'idle') return
        const timer = setInterval(voice.bored, 60_000)
        return () => clearInterval(timer)
    }, [runnerPetVoiceEnabled, voiceVisible, position.dragging, animation, state.mood, selectedId, voice.bored])
    const message = animation === 'happy' || animation === 'tap' ? t('runner.pet.happy')
        : animation === 'bored' || animation === 'celebrate' ? t(`runner.pet.message.${animation}`)
            : t(`runner.pet.message.${state.mood}`)

    return (
        <div className="runner-pet" style={position.style} data-dragging={position.dragging || undefined}
            data-paused={!visible || undefined} data-mood={state.mood}>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button type="button" className="runner-pet-trigger" {...position.handlers}
                        onClick={event => { if (!position.consumeDragClick(event)) interact() }}
                        aria-label={`${t('runner.pet.title')}: ${moodText}`} title={t('runner.pet.open')}>
                        <RunnerPetSprite animation={position.dragging ? 'drag' : animation} paused={!visible} />
                    </button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content side="top" align="end" sideOffset={12} collisionPadding={position.collisionPadding}
                        className="runner-pet-panel" aria-label={t('runner.pet.title')}>
                        <div className="runner-pet-panel-heading">
                            <div><h2>{t('runner.pet.title')}</h2><p>{t('runner.pet.subtitle')}</p></div>
                            <Popover.Close className="runner-pet-close" aria-label={t('runner.pet.close')}>×</Popover.Close>
                        </div>
                        <div className="runner-pet-scene" data-mood={state.mood} data-paused={!visible || undefined}>
                            <span className="runner-pet-scene-dot runner-pet-scene-dot-a" aria-hidden="true" />
                            <span className="runner-pet-scene-dot runner-pet-scene-dot-b" aria-hidden="true" />
                            <button type="button" className="runner-pet-pat" onClick={interact} aria-label={t('runner.pet.pat')}>
                                <RunnerPetSprite animation={animation} paused={!visible} />
                            </button>
                            <p role="status">{message}</p>
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
                            <button type="button" role="switch" aria-checked={runnerPetVoiceEnabled}
                                aria-label={t('runner.pet.voice')} onClick={() => setRunnerPetVoiceEnabled(!runnerPetVoiceEnabled)}>
                                {t(runnerPetVoiceEnabled ? 'runner.pet.mute' : 'runner.pet.unmute')}
                            </button>
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

export function RunnerPetWidget(props: { connected: boolean }) {
    const { runnerPetEnabled, setRunnerPetEnabled } = useRunnerPetPreference()
    return runnerPetEnabled
        ? <ConnectedRunnerPet connected={props.connected} onHide={() => setRunnerPetEnabled(false)} />
        : null
}
