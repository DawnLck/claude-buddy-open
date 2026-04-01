import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInitialState, getCompanionStats } from './companion.js'

export function getStatePath() {
  return join(homedir(), '.claude-buddy', 'state.json')
}

export function loadState() {
  const statePath = getStatePath()
  if (!existsSync(statePath)) {
    return createInitialState()
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'))
    if (!parsed?.companion) return createInitialState()

    const companion = {
      ...parsed.companion,
      stats: getCompanionStats(parsed.companion),
    }

    const runtime = {
      signalType: parsed?.runtime?.signalType || 'idle',
      ...parsed.runtime,
    }

    return {
      ...parsed,
      version: Math.max(4, parsed.version || 1),
      companion,
      runtime,
    }
  } catch {
    return createInitialState()
  }
}

export function saveState(state) {
  const statePath = getStatePath()
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}
