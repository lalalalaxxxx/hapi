import type { RunnerPetMood } from '@/lib/runnerPet'

// An original dot-matrix sprite; no image downloads or animation loop needed.
const BODY = [
    '     oo     ',
    '    oooo    ',
    '  oooooooo  ',
    ' oooooooooo ',
    'oooooooooooo',
    'oooooooooooo',
    'oooooooooooo',
    'oooooooooooo',
    ' oooooooooo ',
    '  oooooooo  ',
    '   oo  oo   ',
]

export function RunnerPetSprite(props: { mood: RunnerPetMood; happy?: boolean }) {
    const sleepy = props.mood === 'offline'
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" className="runner-pet-sprite" data-mood={props.mood} data-happy={props.happy || undefined}>
            <ellipse className="runner-pet-shadow" cx="50" cy="91" rx="25" ry="4" />
            <g className="runner-pet-body">
                {BODY.flatMap((row, y) => Array.from(row, (cell, x) => cell === 'o'
                    ? <circle key={`${x}-${y}`} cx={17 + x * 6} cy={20 + y * 6} r="2.45" fill="currentColor" />
                    : null))}
                <g className="runner-pet-eyes">
                    {sleepy || props.happy ? (
                        <path d={props.happy ? 'M31 49q5-7 10 0 M59 49q5-7 10 0' : 'M31 49h10 M59 49h10'} fill="none" stroke="var(--pet-eye)" strokeWidth="3.5" strokeLinecap="round" />
                    ) : (
                        <g fill="var(--pet-eye)"><rect x="32" y="43" width="7" height="11" rx="3.5" /><rect x="60" y="43" width="7" height="11" rx="3.5" /></g>
                    )}
                </g>
                <path d="M44 61q6 5 12 0" fill="none" stroke="var(--pet-eye)" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            {props.mood === 'waiting' && <g className="runner-pet-spark" fill="currentColor"><circle cx="86" cy="17" r="8" /><path d="M86 12v5m0 3v1" stroke="var(--pet-eye)" strokeWidth="2" strokeLinecap="round" /></g>}
            {props.happy && <path className="runner-pet-heart" d="M80 19C68 9 70 0 78 5L80 8 82 5C90 0 92 9 80 19Z" fill="#ef7894" />}
        </svg>
    )
}
