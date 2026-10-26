import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PetVoicePlayer } from './voicePlayer'

describe('pet audio playback', () => {
    const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended?: () => void }> = []
    let context: { state: string; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }
    let player: PetVoicePlayer
    beforeEach(async () => {
        vi.useFakeTimers()
        sources.length = 0
        context = { state: 'suspended', resume: vi.fn(async () => { context.state = 'running' }), close: vi.fn(async () => {}) }
        vi.stubGlobal('AudioContext', class {
            get state() { return context.state }
            resume = context.resume
            close = context.close
            decodeAudioData = vi.fn(async () => ({}))
            createBufferSource() {
                const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn() }
                sources.push(source)
                return source
            }
        })
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })))
        player = new PetVoicePlayer('loopy')
        await vi.advanceTimersByTimeAsync(0)
    })
    afterEach(() => { player.dispose(); vi.unstubAllGlobals(); vi.useRealTimers() })

    it('does not queue blocked autoplay, then plays after a gesture', () => {
        expect(player.play('celebrate')).toBe(false)
        player.unlock()
        expect(sources).toHaveLength(0)
        expect(player.play('interact')).toBe(true)
        expect(sources[0].start).toHaveBeenCalledOnce()
    })
    it('suppresses rapid taps and overlapping low priority lines', () => {
        player.unlock()
        player.play('interact')
        expect(player.play('interact')).toBe(false)
        expect(player.play('bored')).toBe(false)
        sources[0].onended?.()
        expect(player.play('interact')).toBe(false)
        vi.advanceTimersByTime(3000)
        expect(player.play('interact')).toBe(true)
    })
    it('loads the selected character pack and shares tap/drag cooldown', async () => {
        expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
            '/pets/loopy-voice-v2/interact.mp3', '/pets/loopy-voice-v2/drag.mp3',
            '/pets/loopy-voice-v2/celebrate.mp3', '/pets/loopy-voice-v2/bored.mp3',
        ])
        player.unlock()
        expect(player.play('drag')).toBe(true)
        sources[0].onended?.()
        expect(player.play('interact')).toBe(false)
        vi.advanceTimersByTime(3000)
        expect(player.play('interact')).toBe(true)
        player.dispose()
        vi.mocked(fetch).mockClear()
        player = new PetVoicePlayer('companion')
        await vi.advanceTimersByTimeAsync(0)
        expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
            '/pets/voice-v1/interact.mp3', '/pets/voice-v1/celebrate.mp3', '/pets/voice-v1/bored.mp3',
        ])
        player.unlock()
        expect(player.play('drag')).toBe(true)
    })
    it('lets completion interrupt a reminder but never repeats or overlaps the cheer', () => {
        player.unlock()
        player.play('bored')
        expect(player.play('celebrate')).toBe(true)
        expect(sources[0].stop).toHaveBeenCalledOnce()
        expect(player.play('celebrate')).toBe(false)
        expect(player.play('interact')).toBe(false)
        expect(sources).toHaveLength(2)
    })
    it('stops and releases audio on disposal', () => {
        player.unlock()
        player.play('bored')
        player.dispose()
        expect(sources[0].stop).toHaveBeenCalledOnce()
        expect(context.close).toHaveBeenCalledOnce()
        expect(player.play('bored')).toBe(false)
    })
    it('silently tolerates unsupported browsers and unavailable clips', async () => {
        player.dispose()
        vi.stubGlobal('AudioContext', undefined)
        player = new PetVoicePlayer('loopy')
        expect(() => player.unlock()).not.toThrow()
        expect(player.play('interact')).toBe(false)
    })
    it('does not replay a request made before a clip finishes loading', async () => {
        player.dispose()
        let finish!: (value: unknown) => void
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
        player = new PetVoicePlayer('loopy')
        player.unlock()
        expect(player.play('bored')).toBe(false)
        finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
        await vi.advanceTimersByTimeAsync(0)
        expect(sources).toHaveLength(0)
        expect(player.play('bored')).toBe(true)
    })
})
