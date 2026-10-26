import type { RunnerPetType } from './catalog'

export type PetVoice = 'interact' | 'drag' | 'celebrate' | 'bored'
const VOICE_PACKS: Record<RunnerPetType, Record<PetVoice, string>> = {
    companion: { interact: 'voice-v1/interact', drag: 'voice-v1/interact', celebrate: 'voice-v1/celebrate', bored: 'voice-v1/bored' },
    loopy: { interact: 'loopy-voice-v2/interact', drag: 'loopy-voice-v2/drag', celebrate: 'loopy-voice-v2/celebrate', bored: 'loopy-voice-v2/bored' },
}

/** Preloaded clips; no microphone, speech service, or queued background speech. */
export class PetVoicePlayer {
    private context: AudioContext | null = null
    private buffers = new Map<string, AudioBuffer>()
    private source: AudioBufferSourceNode | null = null
    private playing: PetVoice | null = null
    private lastInteraction = -Infinity
    private abort = new AbortController()

    constructor(private pet: RunnerPetType) {
        if (typeof AudioContext === 'undefined') return
        try { this.context = new AudioContext() } catch { return }
        for (const path of new Set(Object.values(VOICE_PACKS[pet]))) {
            void this.load(path)
        }
    }

    private async load(path: string) {
        const context = this.context
        if (!context) return
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}pets/${path}.mp3`, { signal: this.abort.signal })
            if (!response.ok) return
            const buffer = await context.decodeAudioData(await response.arrayBuffer())
            if (!this.abort.signal.aborted) this.buffers.set(path, buffer)
        } catch { /* Unavailable audio never interrupts the pet or chat. */ }
    }

    // Must be called synchronously from a user gesture (including touch release).
    unlock() {
        if (this.context?.state === 'suspended') void this.context.resume().catch(() => {})
    }

    play(name: PetVoice): boolean {
        const context = this.context, buffer = this.buffers.get(VOICE_PACKS[this.pet][name])
        if (!context || context.state !== 'running' || !buffer) return false
        const interaction = name === 'interact' || name === 'drag'
        if (interaction && Date.now() - this.lastInteraction < 3000) return false
        // Completion takes priority; repeated events must not restart the same line.
        if (this.source && (this.playing === name || this.playing === 'celebrate' || name === 'bored')) return false
        this.stop()
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.onended = () => {
            source.disconnect()
            if (this.source === source) { this.source = null; this.playing = null }
        }
        this.source = source
        this.playing = name
        source.start()
        if (interaction) this.lastInteraction = Date.now()
        return true
    }

    stop() {
        if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null }
        this.playing = null
    }

    dispose() {
        this.abort.abort()
        this.stop()
        this.buffers.clear()
        if (this.context) void this.context.close().catch(() => {})
        this.context = null
    }
}
