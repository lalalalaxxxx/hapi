import { useEffect, useRef } from 'react'
import { DANCE_COLUMNS, DANCE_DURATION, DANCE_FPS, DANCE_FRAME_HEIGHT, DANCE_FRAME_WIDTH, type DancePlayback } from './dancePlayer'

export function RunnerPetDance({ playback }: { playback: DancePlayback }) {
    const canvas = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const context = canvas.current?.getContext('2d')
        if (!context) return
        let request = 0
        let previous = -1
        const draw = () => {
            const elapsed = Math.max(0, performance.now() - playback.startedAt)
            const frame = Math.min(239, Math.floor(elapsed * DANCE_FPS / 1000))
            if (frame !== previous) {
                context.clearRect(0, 0, DANCE_FRAME_WIDTH, DANCE_FRAME_HEIGHT)
                context.drawImage(playback.image,
                    frame % DANCE_COLUMNS * DANCE_FRAME_WIDTH, Math.floor(frame / DANCE_COLUMNS) * DANCE_FRAME_HEIGHT,
                    DANCE_FRAME_WIDTH, DANCE_FRAME_HEIGHT, 0, 0, DANCE_FRAME_WIDTH, DANCE_FRAME_HEIGHT)
                previous = frame
            }
            if (elapsed < DANCE_DURATION) request = requestAnimationFrame(draw)
        }
        draw()
        return () => cancelAnimationFrame(request)
    }, [playback])
    return <span className="runner-pet-sprite" data-animation={`dance-${playback.id}`} aria-hidden="true">
        <canvas ref={canvas} width={DANCE_FRAME_WIDTH} height={DANCE_FRAME_HEIGHT} className="runner-pet-image" />
    </span>
}
