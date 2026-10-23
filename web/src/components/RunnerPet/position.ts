export type PetPoint = { x: number; y: number }
export type PetRect = { left: number; top: number; width: number; height: number }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export function placeRunnerPet(desired: PetPoint, size: { width: number; height: number }, viewport: PetRect, obstacles: PetRect[]) {
    const gap = 8
    const left = viewport.left + gap
    const top = viewport.top + gap
    const right = viewport.left + viewport.width - gap
    const bottom = viewport.top + viewport.height - gap
    const blocked = obstacles.filter(rect => rect.width > 0 && rect.height > 0)
    for (const scale of [1, .75, .5]) {
        const width = size.width * scale
        const height = size.height * scale
        if (width > right - left || height > bottom - top) continue
        const x = clamp(desired.x, left, right - width)
        const y = clamp(desired.y, top, bottom - height)
        const xs = [x, left, right - width, ...blocked.flatMap(rect => [rect.left - width - gap, rect.left + rect.width + gap])]
        const ys = [y, top, bottom - height, ...blocked.flatMap(rect => [rect.top - height - gap, rect.top + rect.height + gap])]
        const candidates = xs.flatMap(px => ys.map(py => ({ x: px, y: py })))
            .filter(p => p.x >= left && p.x + width <= right && p.y >= top && p.y + height <= bottom)
            .filter(p => blocked.every(rect => p.x + width <= rect.left - gap || p.x >= rect.left + rect.width + gap
                || p.y + height <= rect.top - gap || p.y >= rect.top + rect.height + gap))
            .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
        if (candidates[0]) return { ...candidates[0], width, height, visible: true }
    }
    // A full-screen editor can occupy every safe pixel. Never cover its controls.
    return { x: left, y: top, ...size, visible: false }
}
