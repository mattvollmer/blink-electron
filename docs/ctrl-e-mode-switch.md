# Ctrl+E Mode Switching (Run/Edit) — Proposal

## Summary

Add a keyboard shortcut (Ctrl/Cmd+E) and visible UI state to switch between Run and Edit modes in Blink Desktop. Run mode behaves like the current chat (Enter sends, Shift+Enter newline). Edit mode focuses on composing multi-line instructions and uses Ctrl/Cmd+Enter to send. We will also expose `/run` and `/edit` slash commands and show a mode indicator near the input.

## TUI behavior (reference)

Blink TUI implements a two-mode loop for building and trying your agent:

- Maintains a `mode` state with values `run | edit`
- Keymap includes `Ctrl+E: toggle mode` and shows a status line with `mode: <run|edit>`
- On mode change, the TUI emits an ephemeral `mode-change` message (`entering run mode` / `entering edit mode`)
- The dev server selects the correct client based on mode: the normal agent in run mode or the edit agent in edit mode; the server filters ephemeral messages in run mode

Relevant code (citations):

- Keymaps contain `Ctrl+E: toggle mode` and display `mode:` in the footer <blink-citation id="c57b57b6-2609-46c9-8e41-1dbc4edae997" />
- TUI emits `mode-change` messages when switching modes (run/edit) <blink-citation id="c57b57b6-2609-46c9-8e41-1dbc4edae997" />
- Mode state and filtering of ephemeral messages are handled in the TUI dev loop <blink-citation id="c57b57b6-2609-46c9-8e41-1dbc4edae997" />

## Desktop implementation plan

We’ll implement in two phases to ship value quickly, then grow to full TUI parity.

### Phase 1 — UI/UX parity and input semantics (no server changes)

- Add `mode` to project state: `run | edit` (default: `run`).
- Toggle with `Ctrl/Cmd+E` and via `/run` and `/edit` slash commands.
- Input behavior:
  - Run mode: Enter sends; Shift+Enter inserts newline.
  - Edit mode: Enter inserts newline; Ctrl/Cmd+Enter sends.
- Visuals:
  - Show `mode: run|edit` next to the hint line under the input.
  - Optional: change input border color (blue for run, orange for edit like the TUI).
- Feedback:
  - Toast on toggle: `Entering edit mode` / `Entering run mode`.
  - Hint line updates: include `Ctrl/Cmd+E: Toggle mode`.
- Messaging:
  - Keep using the current agent endpoint (`/_agent/chat`) in both modes for now.
  - No changes to server processes in Phase 1.

Why this works: Users can switch modes and enjoy better input ergonomics immediately without a server change. It mirrors the TUI’s UX affordances and keybinds.

### Phase 2 — Runtime parity (edit agent support)

- Start the Blink dev server instead of the built `agent.js`, matching TUI’s architecture.
  - Spawn `blink dev` and parse its port from output (or add an option/env for a fixed port if available).
  - In run mode, route to the normal agent; in edit mode, route to the edit agent.
  - Filter ephemeral messages in run mode (server already does this; desktop should avoid duplicating ephemerals in UI state).
- Mode change events:
  - Optionally display an ephemeral `mode-change` message in the transcript for parity with TUI.
- Risks/Notes:
  - Moving from built agent to `blink dev` changes startup, and we should retain current build/run as a fallback.

## API/surface changes

- Store (`projectStore.ts`): add `mode` field; `updateProject` should accept partial updates setting `mode`.
- ChatInterface:
  - Local derivation of `mode` from store
  - Key handler for Ctrl/Cmd+E to toggle
  - Update `handleKeyDown` semantics per mode
  - Add `/run` and `/edit` handling at the top of `onSend`
  - Update hint line and optional border color

## Acceptance criteria

- Ctrl/Cmd+E toggles mode and shows a toast; UI hint reflects the mode.
- Run mode: Enter sends; Shift+Enter newline.
- Edit mode: Enter newline; Ctrl/Cmd+Enter sends.
- `/edit` and `/run` commands toggle mode without sending text to the agent.
- Mode persists per agent while the app is open (store-backed).

## Follow-ups

- Switch to `blink dev` as the server for full parity; route requests to edit agent in edit mode.
- Add `mode-change` ephemeral system messages to the transcript (optional, behind a setting).
- Expose settings for default mode and keyboard hints.
