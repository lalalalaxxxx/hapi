import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPetWorld } from './petWorld'

describe('Visible message platforms', () => {
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
    it('uses real message tops, excludes clipped and hidden messages and reserves composer space', () => {
        document.body.innerHTML = '<div data-runner-pet-world style="overflow:auto"><div data-runner-pet-surface="one"></div><div data-runner-pet-surface="clipped"></div><div data-runner-pet-surface="hidden" style="visibility:hidden"></div></div><div data-runner-pet-avoid></div>'
        const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })
        const world = document.querySelector('[data-runner-pet-world]')!
        vi.spyOn(world, 'getBoundingClientRect').mockReturnValue(rect(100, 100, 500, 500))
        vi.spyOn(world.children[0], 'getBoundingClientRect').mockReturnValue(rect(150, 250, 220, 50))
        vi.spyOn(world.children[1], 'getBoundingClientRect').mockReturnValue(rect(150, 90, 220, 50))
        vi.spyOn(world.children[2], 'getBoundingClientRect').mockReturnValue(rect(150, 350, 220, 50))
        vi.spyOn(document.querySelector('[data-runner-pet-avoid]')!, 'getBoundingClientRect').mockReturnValue(rect(0, 600, 800, 168))
        const snapshot = readPetWorld({ x: 200, y: 170, width: 80, height: 80, visible: true })
        expect(snapshot.surfaces.filter(surface => surface.kind === 'bubble')).toEqual([{ id: 'one', left: 150, right: 370, top: 250, kind: 'bubble' }])
        expect(snapshot.surfaces.find(surface => surface.id === 'obstacle-floor-0')?.top).toBe(592)
    })
})
