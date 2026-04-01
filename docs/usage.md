# Usage

## Start

```sh
npm install
npm run dev
```

Recommended workflow:

1. Run Claude Code in one terminal.
2. Run Claude Buddy in a second terminal.
3. Leave both open so Buddy can react to transcript and process activity.

## Keyboard

- `p`: pet the companion
- `m`: mute or unmute the companion
- `r`: refresh the observer immediately
- `q`: quit the TUI

## Display

The current TUI includes:

- a pixel-style default companion sprite generated from `assets/claude-mascot.svg`
- idle, blink, pet, focused, and muted states
- affection and mood indicators
- a Claude Code observer panel
- a local reaction bubble

## Persistence

The app stores local state in:

```text
~/.claude-buddy/state.json
```

## Claude Code Observation

The current prototype observes Claude Code in a lightweight way by:

- checking for active Claude-like processes
- scanning `~/.claude/projects` for the most recently updated transcript file

This observer is intentionally simple and local-only. It is meant as an adapter layer, not a deep integration.
