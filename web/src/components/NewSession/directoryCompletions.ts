import type { MachineListDirectoryResponse } from '@hapi/protocol/apiTypes'
import type { Suggestion } from '@/hooks/useActiveSuggestions'

type ListDirectory = (path: string) => Promise<MachineListDirectoryResponse>

export function isDirectoryCompletion(suggestion: Suggestion): boolean {
    return suggestion.key.startsWith('directory:')
}

/** Read only the requested level; the runner enforces any configured workspace roots. */
export async function getDirectoryCompletions(
    query: string,
    recentPaths: readonly string[],
    listDirectory?: ListDirectory
): Promise<Suggestion[]> {
    const input = query.trim()
    const windows = /^[a-z]:/i.test(input) || input.startsWith('\\\\')
    const separator = windows && !input.includes('/') ? '\\' : '/'
    const normalize = (path: string) => windows ? path.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') : path.replace(/\/$/, '')
    const history = recentPaths.filter(path => normalize(path).toLowerCase().includes(normalize(input).toLowerCase()))
        .slice(0, 8).map(path => ({ key: path, text: path, label: path }))
    // A bare drive is its root, never the process's remembered cwd on that drive.
    const path = /^[a-z]:$/i.test(input) ? `${input}\\` : input
    const absolute = /^[a-z]:[\\/]/i.test(path) || path.startsWith('/') || /^\\\\[^\\]+\\[^\\]+/.test(path)
    if (!listDirectory || !absolute) return history

    try {
        let parent = path
        let prefix = ''
        let result = await listDirectory(parent)
        if (!result.success) {
            const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
            if (index < 0 || index === path.length - 1) return history
            parent = path.slice(0, index + 1)
            prefix = path.slice(index + 1)
            result = await listDirectory(parent)
        }
        if (!result.success) return history

        const base = /[\\/]$/.test(parent) ? parent : `${parent}${separator}`
        const directories = (result.entries ?? [])
            .filter(entry => entry.type === 'directory'
                && (windows ? entry.name.toLowerCase().startsWith(prefix.toLowerCase()) : entry.name.startsWith(prefix)))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map(entry => {
                const text = `${base}${entry.name}${separator}`
                return { key: `directory:${text}`, text, label: text }
            })
        const seen = new Set(directories.map(item => normalize(item.text)))
        return [...directories, ...history.filter(item => !seen.has(normalize(item.text)))]
    } catch {
        // A disconnected machine must not prevent selecting a recent path.
        return history
    }
}
