export type PetVoice = 'interact' | 'celebrate' | 'bored'

/** Preloaded clips; no microphone, speech service, or queued background speech. */
export class PetVoicePlayer {
    private context: AudioContext | null = null
    private buffers = new Map<PetVoice, AudioBuffer>()
    private source: AudioBufferSourceNode | null = null
    private playing: PetVoice | null = null
    private lastInteraction = -Infinity
    private abort = new AbortController()

    constructor() {
        if (typeof AudioContext === 'undefined') return
        try { this.context = new AudioContext() } catch { return }
        for (const name of ['interact', 'celebrate', 'bored'] as const) {
            void this.load(name)
        }
    }

    private async load(name: PetVoice) {
        const context = this.context
        if (!context) return
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}pets/voice-v1/${name}.mp3`, { signal: this.abort.signal })
            if (!response.ok) return
            const buffer = await context.decodeAudioData(await response.arrayBuffer())
            if (!this.abort.signal.aborted) this.buffers.set(name, buffer)
        } catch { /* Unavailable audio never interrupts the pet or chat. */ }
    }

    // Must be called synchronously from a user gesture (including touch release).
    unlock() {
        if (this.context?.state === 'suspended') void this.context.resume().catch(() => {})
    }

    play(name: PetVoice): boolean {
        const context = this.context, buffer = this.buffers.get(name)
        if (!context || context.state !== 'running' || !buffer) return false
        if (name === 'interact' && Date.now() - this.lastInteraction < 3000) return false
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
        if (name === 'interact') this.lastInteraction = Date.now()
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
