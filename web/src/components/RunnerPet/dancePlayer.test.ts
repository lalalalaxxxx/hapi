import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoboDancePlayer } from './dancePlayer'

describe('Bobo dance media lifecycle', () => {
    let player: BoboDancePlayer
    const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = []
    const images: Array<{ close: ReturnType<typeof vi.fn> }> = []
    let state = 'suspended'
    let outputTimestamp: AudioTimestamp = { contextTime: 0, performanceTime: 0 }
    beforeEach(() => {
        vi.useFakeTimers()
        state = 'suspended'; sources.length = 0; images.length = 0
        outputTimestamp = { contextTime: 0, performanceTime: 0 }
        vi.stubGlobal('AudioContext', class {
            currentTime = 40
            baseLatency = 0.01
            outputLatency = 0.04
            getOutputTimestamp = () => outputTimestamp
            get state() { return state }
            resume = vi.fn(async () => { state = 'running' })
            close = vi.fn(async () => {})
            decodeAudioData = vi.fn(async () => ({}))
            createBufferSource() {
                const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn() }
                sources.push(source); return source
            }
        })
        vi.stubGlobal('createImageBitmap', vi.fn(async () => {
            const bitmap = { width: 2560, height: 3600, close: vi.fn() }
            images.push(bitmap); return bitmap
        }))
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(), arrayBuffer: async () => new ArrayBuffer(1) })))
        player = new BoboDancePlayer()
    })
    afterEach(() => { player.dispose(); vi.unstubAllGlobals(); vi.useRealTimers() })

    it('preloads silently, then pairs the selected atlas with exactly ten seconds of music', async () => {
        await vi.advanceTimersByTimeAsync(0)
        expect(sources).toHaveLength(0)
        const result = await player.play('bounce', true)
        expect(result?.id).toBe('bounce')
        expect(result?.image).toBe(images[1])
        expect(sources[0].start).toHaveBeenCalledWith(40.03, 0, 10)
        await player.play('pendulum', true)
        expect(sources[0].stop).toHaveBeenCalledOnce()
        expect(sources).toHaveLength(2)
    })
    it('aligns the visual start and end timer with the audible output clock', async () => {
        outputTimestamp = { contextTime: 39.92, performanceTime: 1000 }
        const result = await player.play('pendulum', true)
        expect(result?.startedAt).toBeCloseTo(1110)
        expect(sources[0].start).toHaveBeenCalledWith(40.03, 0, 10)
    })
    it('accounts for output latency before the browser has an output timestamp', async () => {
        const now = performance.now()
        const result = await player.play('pendulum', true)
        expect(result?.startedAt).toBeCloseTo(now + 80)
    })
    it('renders silently when muted without starting or queueing a sound', async () => {
        expect((await player.play('pendulum', false))?.id).toBe('pendulum')
        expect(state).toBe('suspended')
        expect(sources).toHaveLength(0)
    })
    it('cancels a pending click and closes decoded atlases on disposal', async () => {
        const pending = player.play('bounce', true)
        player.stop()
        expect(await pending).toBeNull()
        player.dispose()
        expect(images.every(image => image.close.mock.calls.length === 1)).toBe(true)
        expect(sources).toHaveLength(0)
    })
    it('tolerates a missing audio clip but rejects malformed visual assets', async () => {
        player.dispose()
        vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !url.endsWith('.mp3'), blob: async () => new Blob() })))
        player = new BoboDancePlayer()
        expect((await player.play('bounce', true))?.id).toBe('bounce')
        expect(sources).toHaveLength(0)
        player.dispose()
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() })))
        player = new BoboDancePlayer()
        expect(await player.play('bounce', true)).toBeNull()
    })
})
