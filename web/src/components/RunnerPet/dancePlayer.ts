export const BOBO_DANCES = ['pendulum', 'bounce'] as const
export type BoboDance = typeof BOBO_DANCES[number]
export const DANCE_DURATION = 10_000
export const DANCE_FPS = 24
export const DANCE_FRAME_WIDTH = 160
export const DANCE_FRAME_HEIGHT = 240
export const DANCE_COLUMNS = 16
export type DancePlayback = { id: BoboDance; image: ImageBitmap; startedAt: number }
type DancePack = { image: ImageBitmap; audio: AudioBuffer | null }

/** A single clock drives both canvases; each click owns at most one audio source. */
export class BoboDancePlayer {
    private context: AudioContext | null = null
    private source: AudioBufferSourceNode | null = null
    private packs = new Map<BoboDance, Promise<DancePack | null>>()
    private images = new Set<ImageBitmap>()
    private abort = new AbortController()
    private request = 0

    constructor() {
        try { this.context = new AudioContext() } catch { /* Silent animation remains available. */ }
        for (const id of BOBO_DANCES) this.packs.set(id, this.load(id))
    }

    private async load(id: BoboDance): Promise<DancePack | null> {
        const asset = id === 'pendulum' ? 'pendulum-v3' : id
        const base = `${import.meta.env.BASE_URL}pets/bobo-dance-v2/${asset}`
        const audio = this.context ? fetch(`${base}.mp3`, { signal: this.abort.signal })
            .then(async response => response.ok ? this.context?.decodeAudioData(await response.arrayBuffer()) ?? null : null)
            .catch(() => null) : Promise.resolve(null)
        try {
            const response = await fetch(`${base}.webp`, { signal: this.abort.signal })
            if (!response.ok) return null
            const image = await createImageBitmap(await response.blob())
            if (this.abort.signal.aborted) { image.close(); return null }
            if (image.width !== DANCE_COLUMNS * DANCE_FRAME_WIDTH || image.height !== 15 * DANCE_FRAME_HEIGHT) {
                image.close(); return null
            }
            this.images.add(image)
            const buffer = await audio
            if (this.abort.signal.aborted) return null
            return { image, audio: buffer }
        } catch { return null }
    }

    async play(id: BoboDance, sound: boolean): Promise<DancePlayback | null> {
        this.stop()
        const request = this.request
        // Resume immediately within the original trusted click, before awaiting assets.
        const resume = sound && this.context?.state === 'suspended'
            ? this.context.resume().catch(() => {}) : Promise.resolve()
        const [pack] = await Promise.all([this.packs.get(id), resume])
        if (!pack || this.abort.signal.aborted || request !== this.request) return null
        const startedAt = performance.now()
        if (sound && pack.audio && this.context?.state === 'running') {
            const source = this.context.createBufferSource()
            source.buffer = pack.audio
            source.connect(this.context.destination)
            source.onended = () => {
                source.disconnect()
                if (this.source === source) this.source = null
            }
            this.source = source
            source.start(0, 0, DANCE_DURATION / 1000)
        }
        return { id, image: pack.image, startedAt }
    }

    stopAudio() {
        if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null }
    }

    stop() { this.request++; this.stopAudio() }

    dispose() {
        this.stop()
        this.abort.abort()
        for (const image of this.images) image.close()
        this.images.clear()
        this.packs.clear()
        if (this.context) void this.context.close().catch(() => {})
        this.context = null
    }
}
