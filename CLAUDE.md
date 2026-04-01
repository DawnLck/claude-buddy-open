# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies (ink, react)
npm run dev          # Run the terminal UI companion
npm run pixel-editor # Start pixel editor web server at http://127.0.0.1:4310
```

There is no build step, no linter, and no test suite. The project runs directly as ES modules.

## Architecture

Claude Buddy is a terminal companion UI (TUI) that runs alongside Claude Code. It renders a pixel-art mascot in the terminal, observes Claude Code activity, and reacts with personality-driven messages.

### Data flow

1. `src/cli.js` — entry point; renders `BuddyApp` via Ink
2. `src/ui/BuddyApp.js` — root React/Ink component; owns all state and drives the render loop (350ms animation tick, 2.5s observer poll)
3. `src/core/companion.js` — pure functions for profile generation and state transitions (`petCompanion`, `applyObservation`, `getSpriteVariant`)
4. `src/core/storage.js` — reads/writes `~/.claude-buddy/state.json`
5. `src/core/svgSprite.js` — rasterizes `assets/claude-mascot.svg` (24×24 grid) into terminal half-block characters at startup; produces named animation variants
6. `src/integrations/claudeCodeObserver.js` — polls `~/.claude/projects` for .jsonl transcript file changes and scans the process list to detect Claude Code activity

### Companion profile

Profiles are **deterministic**: `deterministicProfile(seedText)` hashes the home directory path to pick species, rarity, name, and personality. Changing the seed changes the companion entirely. State version is tracked (`version: 2` in `state.json`).

### SVG → terminal pipeline

`svgSprite.js` parses SVG path commands (M/H/V/Z only), rasterizes polygons using an even-odd fill rule, then converts the boolean grid to Unicode half-block characters (`▀`, `▄`, `█`). Animation variants (blink, pet, focused, muted, alert) are derived from the same base grid by pixel manipulation at load time — not at render time.

### Pixel editor

`scripts/pixel-editor-server.mjs` serves a 24×24 web canvas editor on port 4310. Saving writes directly to `assets/claude-mascot.svg`. Restart `npm run dev` to pick up SVG changes.

## Key conventions

- **ES modules throughout** — use `.js` extensions in imports, no CommonJS
- **No external network calls** — local-only by design; state lives in `~/.claude-buddy/`
- **Explicit state shapes** — companion and runtime state are plain objects with documented fields; avoid adding opaque blobs
- **Pure core, effectful UI** — `src/core/` functions are side-effect-free; persistence and process calls belong in storage/integrations/UI layers
