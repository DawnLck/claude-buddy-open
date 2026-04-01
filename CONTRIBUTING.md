# Contributing

## Principles

- Keep the project local-first
- Avoid proprietary service dependencies
- Prefer deterministic behavior over opaque generation
- Keep the runtime simple and auditable

## Getting Started

1. Fork the repository.
2. Create a branch for your change.
3. Keep changes focused.
4. Add or update documentation when behavior changes.
5. Open a pull request with a short explanation of the design and tradeoffs.

## Contribution Areas

- core companion model
- terminal rendering
- persistence format
- CLI adapters
- tests
- docs

## Style

- Prefer small modules
- Prefer explicit data structures
- Avoid hidden side effects
- Keep user-facing output concise

## Before Opening a PR

- Verify the docs still match the code
- Add tests when the behavior is stable enough to pin down
- Call out any intentionally incomplete parts
