# Claude Buddy

Claude Buddy is an open-source terminal companion project inspired by the lightweight buddy module explored in Claude Code.

It aims to provide a small, deterministic, local-first companion experience that can live beside a terminal AI workflow without depending on private services or proprietary backend logic.

The current prototype is a standalone Ink TUI that runs beside Claude Code in a separate terminal. Its default companion uses a pixel-style terminal sprite inspired by the blocky mascot shape from Claude Code's welcome screen.
The default mascot is generated from a checked-in SVG asset, then rasterized into terminal characters at runtime.

## Project Goals

- Local-first companion behavior
- Deterministic pet generation
- Minimal runtime dependencies
- Easy embedding into terminal or CLI tools
- Clean open-source development workflow

## Scope

This repository is intended to become the standalone home for:

- companion data generation
- terminal sprite rendering
- simple reactions
- local state persistence
- CLI-facing buddy commands

## Planned Features

- Companion hatching
- Deterministic name and personality generation
- Pixel sprite rendering with idle, blink, pet, and watch states
- SVG-to-terminal mascot pipeline for the default companion
- Local persistence and lightweight Claude Code observation
- Optional adapters for existing CLI tools

## Repository Layout

```text
.
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── .gitignore
├── package.json
├── src/
└── docs/
```

## Running The TUI

Install dependencies and start the terminal UI:

```sh
npm install
npm run dev
```

## Pixel Editor

Launch the local web-based pixel editor:

```sh
npm run pixel-editor
```

Then open:

```text
http://127.0.0.1:4310
```

The editor reads and writes [claude-mascot.svg](/Users/echo/Desktop/claude-buddy-open/assets/claude-mascot.svg) so you can quickly tweak the mascot shape on a 24x24 grid.

The current prototype provides:

- a standalone companion TUI
- local state persistence in `~/.claude-buddy/state.json`
- a pixel-style animated sprite
- keyboard controls for petting, mute, and manual refresh
- a lightweight Claude Code observer that watches `~/.claude/projects`

## Controls

- `p`: pet the companion
- `m`: mute or unmute
- `r`: manually refresh the Claude Code observer
- `q`: quit

## Development

This repository now contains a working prototype. The next implementation phase should add:

1. species-specific sprite packs and themes
2. configurable layouts and compact modes
3. a more robust Claude Code event adapter
4. tests around persistence, animation state, and observation logic

### Releasing New Versions

To release a new version, use the provided release helper:

```bash
python3 scripts/release.py [patch|minor|major]
```

This will update the `VERSION` file and `package.json`, then provide the necessary Git commands to tag and push the release.

## License

MIT. See [LICENSE](./LICENSE).
