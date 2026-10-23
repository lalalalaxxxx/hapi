// Reuse the existing global SSE notification stream; the pet opens no extra connection.
const COMPLETED_EVENT = 'hapi:runner-pet-completed'

export function notifyRunnerPetToast(toast: { title: string; sessionId: string }): void {
    // This is the hub's wire title, before UI translation. Ready-for-input can
    // mean a pause, and losing a busy session can mean a disconnect, not success.
    if (toast.title.trim() === 'Task completed') {
        window.dispatchEvent(new CustomEvent(COMPLETED_EVENT, { detail: toast.sessionId }))
    }
}

export function onRunnerPetCompletion(listener: (sessionId: string) => void): () => void {
    const handler = (event: Event) => {
        const sessionId: unknown = (event as CustomEvent).detail
        if (typeof sessionId === 'string') listener(sessionId)
    }
    window.addEventListener(COMPLETED_EVENT, handler)
    return () => window.removeEventListener(COMPLETED_EVENT, handler)
}
