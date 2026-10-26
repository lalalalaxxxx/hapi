# hapi-web

React Mini App / PWA for monitoring and controlling hapi sessions.

## What it does

- Session list with status, pending approvals, todos, and summaries.
- Chat view with streaming updates and message sending.
- Permission approval and denial workflows.
- Codex `request_user_input` choices honor `isOther`: **None of the above**
  focuses optional notes, supports empty notes, and preserves the canonical
  wire value across languages. Recorded other answers and notes remain visible
  in live and historical cards; Pi/MCP forms without the flag are unchanged.
- Permission mode and model selection.
- Machine list and remote session spawn.
- File browser and git status/diff views.
- PWA install prompt and offline banner.
- Optional unread-session count on the Windows taskbar when installed as an Edge/Chrome PWA (toggleable in Display settings; off by default).
- An animated Runner companion reflects online, busy, and pending-input states.
  Its floating button shows only the transparent character. Click it to inspect
  Runner counts, choose a machine, or give it a pat; drag it to reposition it.
  Mouse and touch dragging play a separate reaction and never open the panel.
  The saved position follows viewport changes; arrow keys also move the focused pet. Hide it
  from its panel and restore it in Display settings. It reuses existing SSE/query
  data, pauses animation in hidden tabs, and respects reduced-motion preferences.
  It appears on the session list and inside chats on both desktop and phones.
  The visual viewport and `data-runner-pet-avoid` composer bounds keep it clear
  of the editor and keyboard. It shrinks in tight spaces; only a fully occupied
  viewport temporarily hides it, until room is available again.
  Display settings and the pet panel can switch between the original companion
  and Loopy (the default when no character has been selected). Existing explicit
  character choices are preserved. Character choice, autonomous movement, and animation mode are saved
  per browser/origin and update other tabs on that origin, not other devices.
  Autonomous walks and jumps run every 5–10 seconds when unobstructed; their
  entire paths avoid the composer. Typing, dragging, hovering, scrolling, open
  dialogs, and the pet panel pause autonomous actions. In chats, scrolling still
  carries a pet standing on a message; hovering stops walks but allows landing.
  Reduced-motion preferences disable
  it unless the user explicitly selects Always animate. Disable roaming to keep
  manual positioning and reactions without autonomous movement.

### Runner companion artwork

The companion has nine animations: idle, tap, happy,
bored, celebrate, working, waiting, offline, and drag. All follow the original
approved character concept (kept locally at `output/imagegen/runner-pet-concept-v1.png`), with
natural gestures and hair movement. Connecting reuses the waiting animation.
Status labels and counts continue to reflect real Runner data.
Each loop runs for 2 seconds with 48 playback frames (24 fps). Clicking plays
tap for 2 seconds and a happy response for 2 seconds. Idle
becomes bored after 45 seconds. Only an explicit `Task completed` notification
for an active session on an online selected Runner triggers a 2-second
celebration; a failure, pause, or disconnection does not.

Original art sources and prompts are kept locally in
`output/imagegen/runner-pet-animation-v1/raw/`; these generation artifacts are
not included in Git. The six-frame atlases, animated loops, and static posters
under `web/public/pets/` are committed and sufficient to build the application.
Run `python scripts/dev/runner-pet-assets.py` with Pillow installed to split
the 3-by-2 sheets, clean negligible alpha noise, align grounded poses, and write
six-frame horizontal WebP atlases to `web/public/pets/runner-v1/`. The script
also creates animated WebP previews and, with `imageio-ffmpeg`, an MP4 overview.
It processes existing images only and makes no generation/API requests.
Then run `python scripts/dev/runner-pet-smooth.py` with Pillow, numpy and
opencv-python-headless to create animated WebP loops and static posters under
`web/public/pets/runner-v2/`. This uses optical-flow interpolation between the
existing six generated poses, not 48 separately drawn poses. The tap sequence
returns through a matching pose instead of the original abrupt bow. Occlusion
handling limits double edges, but complex hand movement can retain some drawing
variation. Hidden tabs and reduced-motion mode show a static poster.
Animation timing lives in `src/components/RunnerPet/animations.ts`.
Preview the widget at
`/e2e-fixtures/runner-pet-fixture.html` on the Web development server.

Loopy adds 16 subscription-generated poses, packaged by
`python scripts/dev/runner-pet-loopy.py` from the local source
`output/imagegen/loopy-pet-v1.png`. It uses the same Pillow/numpy/OpenCV toolchain
and makes no API requests. The committed `public/pets/loopy-v1/` contains nine
state loops plus walk (1.4 s), jump (1 s), fall (1 s), and land (0.32 s), with transparent
static posters. Optical-flow inbetweens target 24 fps; these are not separately
drawn frames. Original companion movement reuses working/happy/tap poses with
continuous page movement and CSS body motion; falling reuses the dangling pose.
Each character has its own voice pack; switching pets stops the previous voice.

Loopy's idle and working loops use a single coherent pose with whole-character
breathing and sway. They deliberately avoid optical-flow interpolation across
head turns, which can misalign the eyes and nose. Their `*-stable.webp` URLs
replace the earlier precached clips; legacy URLs also contain the corrected art.

### Message platforms and gravity

Inside a `data-runner-pet-world` chat viewport, both characters stand on visible
`data-runner-pet-surface` message tops. Dropping a pet within 28 px of a ledge
snaps its feet to that ledge. It follows ordinary message scrolling/reflow,
walks along edges, and jumps to nearby messages. Walking off an edge, removing
a message, or scrolling its ledge out of view releases the pet under gravity.
Swept landing checks catch the next platform on descent. Safe floors above the
composer and viewport bottom catch other falls, with a smoke puff on recovery.
Large layout jumps release support rather than teleporting with the message.
Typing, open dialogs, hidden tabs, and dragging pause physics; disabling roaming
or reduced-motion playback stops it entirely. Leaving a chat restores free-page
roaming. Geometry is cached between frames and invalidated on scroll/mutation;
all listeners, timers, and animation frames are cleaned up on disable/unmount.
Preview these scenarios with `/e2e-fixtures/runner-pet-fixture.html?physics=1`.

### Runner companion voice

The original companion's three Mandarin MP3 clips in `public/pets/voice-v1/` respond to clicking
or starting a drag (啊，不要啦), validated task completion
(终于做完啦，快来看看吧～), and each full minute spent bored
(快来陪我玩玩吧). Loopy uses four separate clips in `public/pets/loopy-voice-v2/`:
click/pat (痒！痒！痒！), pickup/drag (嘿嘿，飞起来咯), boredom
(唔，好无聊呀，陪我玩一会儿嘛！), and completion
(耶，做好啦！快来看看，我厉害吧！). Its voice instructions specify a young,
soft, bright cartoon voice with playful surprise, anticipation, and proud excitement.
The first reminder is 60 seconds after entering boredom. Automatic roaming is silent.
Voice defaults on; the panel and Display settings share a persistent mute switch.
Browser autoplay policy requires an initial user gesture. Missed lines are never
queued. Hidden/unfocused pages stop audio; completion takes priority over other
lines, and clicks/drags share a 3-second cooldown. Clips are precached for
offline playback, with no microphone or runtime speech API calls.

The bundled voice uses locally generated Qwen3-TTS Vivian, with separate emotion
instructions for bashful interaction, proud celebration, and playful requests for
company. `scripts/dev/runner-pet-voice-qwen.py` records the text and instructions;
run it with `--model <local CustomVoice model> --output <folder> --speakers Vivian`.
Add `--pet loopy` for the Loopy pack; text and per-action delivery are recorded
alongside each generated WAV. Both packs use the same local model with different instructions.
It needs `qwen-tts` and CUDA PyTorch in an isolated Python environment. Convert the
resulting WAV files to 24 kHz/96 kbps MP3 with FFmpeg (`loudnorm=I=-18:TP=-1.5:LRA=11`).
Loopy v2 additionally raises pitch/formants two semitones while preserving timing:
use `rubberband=pitch=1.122462:tempo=1:formant=shifted` before the loudness filter.
`scripts/dev/runner-pet-voice.py` preserves the earlier Edge speech experiment.
The local generation and bundled playback require no paid speech API and are
independent of HAPI's conversational/dictation voice configuration.

## Runtime behavior

- When opened inside Telegram, auth uses Telegram WebApp init data.
- When opened in a normal browser, you can log in with `CLI_API_TOKEN:<namespace>` (or `CLI_API_TOKEN` for the default namespace).
- The login screen includes a top-right hub picker; if unset, the app uses the same origin it was loaded from.
- Live updates come from the hub via SSE.
- Session `@` suggestions require conversation content, including untitled conversations. Names and directory labels affect display/search, not eligibility; empty stubs stay excluded.

## Routes

See `src/router.tsx` for route definitions.

- `/` - Redirect to /sessions.
- `/sessions` - Session list.
- `/sessions/$sessionId` - Chat interface.
- `/sessions/new` - Create new session.
- `/sessions/$sessionId/files` - File browser with git status.
- `/sessions/$sessionId/file` - File viewer with diff support.
- `/sessions/$sessionId/terminal` - Terminal interface.
- `/browse` - Workspace browser, enabled by the runner's configured workspace roots.
- `/share` - Share-target landing (Web Share Target POST → `?id=`, or native `/share#url=&text=&title=`).
- `/settings` - Settings category hub (mobile) and responsive master-detail shell.
- `/settings/general` - Language preferences.
- `/settings/display` - Appearance, typography, colors, and session list preferences.
- `/settings/chat` - Message input, tool card, and conversation color preferences.
- `/settings/voice` - Everyday voice assistant preferences.
- `/settings/voice/voices` - Full-page voice picker.
- `/settings/voice/advanced` - Voice persona, tuning, and diagnostics.
- `/settings/machines` - Machine management and runner status.
- `/settings/storage` - SQLite storage sizes for the hub owner.
- `/settings/usage` - Cache-aware token usage dashboard for the hub owner.
- `/settings/about` - Application links and version information.

## Features

### Session list (`src/components/SessionList.tsx`)

- Active/inactive status indicator.
- Session title from name, summary, or path.
- Todo progress display.
- Pending permission request count.
- Agent name and model display.
- Directory actions to clean up long-idle/disconnected processes while keeping
  resumable history, or stop and delete all directory sessions from HAPI.
  Directory deletion includes filtered/pinned rows and worktrees on the same
  machine, preserves files on disk, and reports partial failures for retry.
- Active sessions also offer Delete; the hub stops them before removing history.

### Chat interface (`src/components/SessionChat.tsx`)

- Message thread with infinite scroll.
- Composer for sending messages.
- Permission mode and model selection for supported agents.
  Cursor Auto uses CLI Auto for new/resumed sessions configured with Auto. When ACP does not advertise a literal Auto option, the session picker warns that switching back from a concrete model requires a restart; HAPI does not automatically restart an active session.
- Session abort and handoff controls.
- Codex **Continue planning** hides the current proposal's action menu locally
  and focuses the composer without sending a message or replacing its draft.
  The plan document remains readable; recycled cards stay dismissed and new
  proposals get fresh action menus.
- Context size display.
- Per-session scratchlist (`src/components/AssistantChat/ScratchlistPanel.tsx`)
  - Workbench panel for held notes/drafts; **distinct from the queue**.
  - Add/delete/reorder entries; promote to composer (copy) or queue (send).
  - Entries and attachments saved on the hub and synced across devices.
  - Reordering affects only the current view and resets when entries refresh.
  - Keyboard shortcut: Ctrl/Cmd+Shift+S to focus the add-input.

### File browser (`src/routes/sessions/files.tsx`)

- Git status view (staged/unstaged files).
- File search with ripgrep.
- Navigate to file viewer.

### File viewer (`src/routes/sessions/file.tsx`)

- File content display with syntax highlighting.
- Staged/unstaged diff view.

### Terminal (`src/routes/sessions/terminal.tsx`)

- Remote terminal via xterm.js
- Real-time via Socket.IO `/terminal`
- Resize handling

### Voice assistant

- ElevenLabs (@elevenlabs/react), Gemini Live, and Qwen Realtime backends
- Real-time voice control
- Standard and realtime composer dictation with provider capability selection

### New session (`src/components/NewSession/`)

Modular session creation:

- Machine selector
- Directory input with recent paths and live child-directory completion from the selected online machine.
  Enter a Windows drive (`G:` or `G:\`), an absolute directory, or a partial child name;
  choose a suggestion to fill the path and continue browsing its children.
  Windows drive/UNC paths and POSIX paths are supported. Only folders are suggested,
  and configured Runner workspace roots still apply. Recent paths remain available
  when the machine cannot be reached. No directories are created by autocomplete.
- Agent type selector
- Model selector
- Per-agent permission, effort, and collaboration controls when supported

### First-User-Experience (FUE)

For a new, non-essential feature whose affordance would otherwise be hard to
discover, consider the existing FUE primitive rather than a permanent UI block.
Optional, not a requirement for every feature or a reason to expand a bug fix.

- `src/lib/use-fue.ts`: `useFue(featureId)` returns `{ status, engage, dismiss }`; acknowledgement is isolated per feature in `hapi.fue.v1.<featureId>` localStorage keys.
- `src/components/Fue.tsx`: `FueDot` marks the affordance; `FueCallout` explains it while `status === 'engaging'`.
- Dismissal requires an affirmative user action ("Got it"), never an auto-timeout.
- The FUE dot and feature-specific badges/counters are mutually exclusive; onboarding wins until acknowledged.
- Opt in per feature; skip the wrapper if an upstream component already supplies onboarding.
- Working example: `ScratchlistToggleButton` in `src/components/AssistantChat/ComposerButtons.tsx`. Use the source rather than maintaining a copied example here.

## Authentication

See `src/hooks/useAuth.ts` and `src/hooks/useAuthSource.ts`.

- Telegram Mini App: Uses initData from WebApp SDK.
- Browser: Uses CLI_API_TOKEN from login prompt.
- JWT tokens with auto-refresh.
- Authentication has a 15-second deadline, including response body reads. A stalled
  browser login returns to the login screen with a network/Hub URL error instead
  of staying on the authentication spinner. Existing access tokens are retained.

## Data fetching

See `src/hooks/queries/` for query hooks and `src/hooks/mutations/` for mutations.

- Sessions, messages, machines via TanStack Query.
- Git status and file operations.
- Optimistic updates for message sending.

## Real-time updates

See `src/hooks/useSSE.ts`.

- SSE connection to `/api/events`.
- Session/message/machine update events.
- Automatic cache invalidation on events.

## Stack

React 19 + Vite + TanStack Router/Query + Tailwind + @assistant-ui/react + xterm.js + @elevenlabs/react + socket.io-client + workbox + shiki.

## Source structure

- `src/router.tsx` - Route definitions.
- `src/components/` - UI components.
- `src/hooks/` - Data fetching and state hooks.
- `src/api/client.ts` - API client.
- `src/types/api.ts` - Type definitions.

## Development

From the repo root:

```bash
bun install
bun run dev:web
```


If testing in Telegram, set:

- `HAPI_PUBLIC_URL` to the public HTTPS URL of the dev server.
- `CORS_ORIGINS` to include the dev server origin.

## Tests

Unit tests run under vitest + jsdom:

```bash
bun run test:web
```

End-to-end browser tests for the scratchlist component (real Chromium, real
`inert` focus blocking, real localStorage round-trips) live at the repo root
under `e2e/`:

```bash
bun run test:e2e          # headless
bun run test:e2e:ui       # Playwright UI mode (debug)
```

The spec drives a Vite-served fixture page (`web/e2e-fixtures/scratchlist-fixture.html`)
that mounts the production `ScratchlistPanel` in isolation, so no hub /
auth / socket setup is required.

## Build

```bash
bun run build:web
```

The built assets land in `web/dist` and are served by hapi-hub. The single executable can embed these assets.

## Standalone hosting

You can host `web/dist` on a static host (GitHub Pages, Cloudflare Pages) and point it at any hapi hub:

1. Build the web app. If your static host uses a subpath, set the Vite base:

```bash
bun run build:web -- --base /<repo>/
```

2. Deploy `web/dist` to your static host.
3. Set hub CORS to allow the static origin (`HAPI_PUBLIC_URL` or `CORS_ORIGINS`).
4. Open the static site, click the top-right Hub button on the login screen, and enter the hapi hub origin.

Clear the hub override in the same dialog to return to same-origin behavior.
