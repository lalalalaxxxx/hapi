import { describe, expect, it, vi } from 'vitest'
import { getDirectoryCompletions, isDirectoryCompletion } from './directoryCompletions'

const entries = (...names: string[]) => ({ success: true as const, entries: names.map(name => ({ name, type: 'directory' as const })) })

describe('directory completions', () => {
    it.each(['G:', 'G:\\'])('lists a Windows drive root entered as %s', async query => {
        const list = vi.fn().mockResolvedValue(entries('Code'))
        const result = await getDirectoryCompletions(query, [], list)
        expect(list).toHaveBeenCalledWith('G:\\')
        expect(result.map(item => item.text)).toEqual(['G:\\Code\\'])
        expect(isDirectoryCompletion(result[0])).toBe(true)
    })

    it('lists children of an existing path without requiring a trailing slash', async () => {
        const list = vi.fn().mockResolvedValue(entries('QQSpeed', 'HKGame_Dev'))
        const result = await getDirectoryCompletions('G:\\Code', [], list)
        expect(result.map(item => item.text)).toEqual(['G:\\Code\\HKGame_Dev\\', 'G:\\Code\\QQSpeed\\'])
    })

    it('completes a partial Windows name case-insensitively and excludes files', async () => {
        const list = vi.fn().mockResolvedValueOnce({ success: false, error: 'not found' })
            .mockResolvedValueOnce({ success: true, entries: [
                { name: 'QQSpeed', type: 'directory' }, { name: 'Other', type: 'directory' },
                { name: 'qq.txt', type: 'file' }
            ] })
        const result = await getDirectoryCompletions('G:\\Code\\qq', [], list)
        expect(list.mock.calls.map(call => call[0])).toEqual(['G:\\Code\\qq', 'G:\\Code\\'])
        expect(result.map(item => item.text)).toEqual(['G:\\Code\\QQSpeed\\'])
    })

    it.each([
        ['G:/Code/', 'G:/Code/QQSpeed/'],
        ['\\\\server\\share\\', '\\\\server\\share\\QQSpeed\\'],
        ['/home/', '/home/QQSpeed/']
    ])('preserves path syntax for %s', async (query, expected) => {
        expect((await getDirectoryCompletions(query, [], vi.fn().mockResolvedValue(entries('QQSpeed'))))[0].text).toBe(expected)
    })

    it('keeps POSIX prefix matching case-sensitive', async () => {
        const list = vi.fn().mockResolvedValueOnce({ success: false }).mockResolvedValueOnce(entries('Code', 'code'))
        expect((await getDirectoryCompletions('/home/co', [], list)).map(item => item.text)).toEqual(['/home/code/'])
    })

    it('keeps all child directories selectable and deduplicates recent paths', async () => {
        const list = vi.fn().mockResolvedValue(entries(...Array.from({ length: 60 }, (_, i) => `project${i}`)))
        const result = await getDirectoryCompletions('G:\\', ['g:\\project0'], list)
        expect(result).toHaveLength(60)
        expect(result[2].text).toBe('G:\\project2\\')
    })

    it('retains recent paths when the runner refuses a directory or is offline', async () => {
        const recent = ['G:\\Code\\QQSpeed']
        for (const list of [vi.fn().mockResolvedValue({ success: false }), vi.fn().mockRejectedValue(new Error('offline'))]) {
            expect((await getDirectoryCompletions('G:\\Code\\', recent, list)).map(item => item.text)).toEqual(recent)
        }
    })

    it('does not probe relative paths or incomplete UNC server names', async () => {
        const list = vi.fn()
        for (const query of ['', 'qq', '\\\\server']) await getDirectoryCompletions(query, [], list)
        expect(list).not.toHaveBeenCalled()
    })

    it('preserves case-insensitive free-text search in recent paths', async () => {
        const recent = ['G:\\Code\\QQSpeed']
        expect((await getDirectoryCompletions('qq', recent)).map(item => item.text)).toEqual(recent)
    })
})
