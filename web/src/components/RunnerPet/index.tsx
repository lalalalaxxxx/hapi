import { useEffect, useState, type CSSProperties } from 'react'
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
import { useRunnerPetSettings } from '@/hooks/useRunnerPetSettings'
import { RUNNER_PETS } from './catalog'
import { useRunnerPetMotion } from './useRunnerPetMotion'
import { useRunnerPetRoaming } from './useRunnerPetRoaming'
import { useRunnerPetWorld } from './petWorld'
import { useRunnerPetPhysics } from './useRunnerPetPhysics'
import { useRunnerPetDance } from './useRunnerPetDance'
import { RunnerPetDance } from './RunnerPetDance'
import './runner-pet.css'

export function RunnerPet(props: {
    machines: Machine[]
    sessions: SessionSummary[]
    connected: boolean
    loading?: boolean
    hasError?: boolean
}) {
    const { t } = useTranslation()
    const visible = useDocumentVisibility()
    const settings = useRunnerPetSettings()
    const petTitle = t(settings.pet === 'companion' ? 'runner.pet.title' : RUNNER_PETS[settings.pet].name)
    const animated = useRunnerPetMotion(settings.motion)
    const position = useRunnerPetPosition(RUNNER_PETS[settings.pet].aspectRatio)
    const [hovered, setHovered] = useState(false)
    const [arriving, setArriving] = useState(false)
    const selectedId = ''
    const state = getRunnerPetState({ ...props, machineId: selectedId })
    const moodText = t(`runner.pet.state.${state.mood}`)
    const { runnerPetVoiceEnabled } = useRunnerPetVoicePreference()
    const voiceVisible = visible && position.style.visibility !== 'hidden'
    const voice = useRunnerPetVoice({ enabled: runnerPetVoiceEnabled, visible: voiceVisible, machineId: selectedId, pet: settings.pet })
    const dance = useRunnerPetDance({ enabled: settings.pet === 'companion' && animated,
        available: voiceVisible && !position.dragging && state.mood !== 'offline' && state.mood !== 'connecting',
        sound: runnerPetVoiceEnabled, machineId: selectedId })
    const { animation, interact: animateInteraction } = useRunnerPetAnimation({
        ...props, mood: state.mood, machineId: selectedId, visible,
        onCelebrate: () => { dance.cancel(); voice.celebrate() },
    })
    const interact = () => {
        if (animation === 'celebrate' || dance.busy) return
        animateInteraction()
        if (settings.pet === 'companion' && animated && state.mood !== 'offline' && state.mood !== 'connecting') {
            voice.stop()
            void dance.start()
        } else voice.interaction()
    }
    const world = useRunnerPetWorld()
    const canMove = settings.roaming && animated && voiceVisible && !position.dragging && !dance.busy
        && ['idle', 'bored', 'working'].includes(animation)
    const freeRoaming = useRunnerPetRoaming({
        enabled: canMove && !hovered && !world,
        pet: settings.pet, getPlacement: position.getPlacement, moveTo: position.moveTo,
    })
    const physics = useRunnerPetPhysics({ enabled: canMove && world, hovered,
        pet: settings.pet, getPlacement: position.getPlacement, moveTo: position.moveTo })
    const roaming = world ? physics : freeRoaming
    useEffect(() => {
        if (!animated || !visible) { setArriving(false); return }
        setArriving(true)
        const timer = setTimeout(() => setArriving(false), 650)
        return () => clearTimeout(timer)
    }, [settings.pet, animated, visible, physics.poof])
    useEffect(() => { if (position.dragging) voice.drag() }, [position.dragging, voice.drag])
    useEffect(() => {
        if (!runnerPetVoiceEnabled || !voiceVisible || position.dragging || dance.busy || animation !== 'bored' || state.mood !== 'idle') return
        const timer = setInterval(voice.bored, 60_000)
        return () => clearInterval(timer)
    }, [runnerPetVoiceEnabled, voiceVisible, position.dragging, dance.busy, animation, state.mood, selectedId, voice.bored])

    return (
        <div className="runner-pet" style={position.style} data-dragging={position.dragging || undefined}
            data-pet={settings.pet} data-motion={roaming.motion ?? undefined} data-motion-mode={settings.motion}
            data-support={physics.supportId ?? undefined}
            data-facing-left={roaming.facingLeft || undefined} data-paused={!visible || undefined} data-mood={state.mood}>
            {arriving && <span className="runner-pet-poof" key={`${settings.pet}-${physics.poof}`} aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ '--puff': index } as CSSProperties} />)}
            </span>}
            <button type="button" className="runner-pet-trigger" {...position.handlers}
                onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
                onPointerLeave={() => setHovered(false)}
                onClick={event => { if (!position.consumeDragClick(event)) interact() }}
                aria-label={`${petTitle}: ${moodText}`}
                title={t(settings.pet === 'companion' ? 'runner.pet.pat' : 'runner.pet.pat.loopy')}>
                {dance.playback && !position.dragging ? <RunnerPetDance playback={dance.playback} />
                    : <RunnerPetSprite key={settings.pet} pet={settings.pet} motion={settings.motion}
                        animation={position.dragging ? 'drag' : roaming.motion ?? animation} paused={!visible} />}
            </button>
        </div>
    )
}

function ConnectedRunnerPet(props: { connected: boolean }) {
    const { api, baseUrl } = useAppContext()
    const machines = useMachines(api, true)
    const sessions = useSessions(api)
    return <RunnerPet key={baseUrl} machines={machines.machines} sessions={sessions.sessions}
        connected={props.connected} loading={machines.isLoading || sessions.isLoading}
        hasError={Boolean(machines.error || sessions.error)} />
}

export function RunnerPetWidget(props: { connected: boolean }) {
    const { runnerPetEnabled } = useRunnerPetPreference()
    return runnerPetEnabled
        ? <ConnectedRunnerPet connected={props.connected} />
        : null
}
