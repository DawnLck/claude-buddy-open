import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInitialState } from './companion.js'

export function getStatePath() {
  return join(homedir(), '.claude-buddy', 'state.json')
}

export function loadState() {
  const statePath = getStatePath()
  if (!existsSync(statePath)) {
    return createInitialState()
  }

  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return createInitialState()
  }
}

export function saveState(state) {
  const statePath = getStatePath()
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}
