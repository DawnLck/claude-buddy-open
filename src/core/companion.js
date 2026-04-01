import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSvgSpriteSet } from './svgSprite.js'

export const SPECIES = [
  'duck',
  'goose',
  'blob',
  'cat',
  'dragon',
  'octopus',
  'owl',
  'penguin',
  'turtle',
  'snail',
  'ghost',
  'axolotl',
  'capybara',
  'cactus',
  'robot',
  'rabbit',
  'mushroom',
  'chonk',
]

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const NAMES = [
  'Pip',
  'Mochi',
  'Byte',
  'Pebble',
  'Nori',
  'Pico',
  'Miso',
  'Tango',
  'Clover',
  'Nova',
  'Patch',
  'Biscuit',
]

const TRAITS = [
  'curious and quietly judgmental',
  'small, brave, and a little dramatic',
  'patient until the keyboard gets loud',
  'suspicious of flaky tests',
  'fond of clean diffs and warm terminals',
  'delighted by passing builds',
  'calm, observant, and slightly smug',
  'supportive with a sharp sense of timing',
]

export const COMPANION_STAT_KEYS = [
  'debugging',
  'patience',
  'chaos',
  'wisdom',
  'snark',
]

const RARITY_STAR_COUNT = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const mascotSmallPath = join(__dirname, '..', '..', 'assets', 'claude-mascot-small.svg')
const mascotDefaultPath = join(__dirname, '..', '..', 'assets', 'claude-mascot.svg')
const mascotSprite = loadSvgSpriteSet(existsSync(mascotSmallPath) ? mascotSmallPath : mascotDefaultPath)

export const SPRITE_VARIANTS = {
  ...mascotSprite.variants,
}

export const SPECIES_COLORS = {
  duck: 'yellow',
  goose: 'white',
  blob: 'magenta',
  cat: 'yellow',
  dragon: 'red',
  octopus: 'magenta',
  owl: 'yellow',
  penguin: 'cyan',
  turtle: 'green',
  snail: 'yellow',
  ghost: 'white',
  axolotl: 'magenta',
  capybara: 'yellow',
  cactus: 'green',
  robot: mascotSprite.accent,
  rabbit: 'white',
  mushroom: 'red',
  chonk: mascotSprite.accent,
}

function hash(text) {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function pick(items, seed) {
  return items[seed % items.length]
}

function statValue(seedText, label) {
  const raw = hash(`${seedText}:${label}:stat`)
  return 18 + (raw % 78)
}

function buildStats(seedText) {
  return {
    debugging: statValue(seedText, 'debugging'),
    patience: statValue(seedText, 'patience'),
    chaos: statValue(seedText, 'chaos'),
    wisdom: statValue(seedText, 'wisdom'),
    snark: statValue(seedText, 'snark'),
  }
}

export function deterministicProfile(seedText = homedir()) {
  const seed = hash(`${seedText}:claude-buddy-open`)
  return {
    species: pick(SPECIES, seed),
    rarity: pick(RARITIES, Math.floor(seed / 17)),
    name: pick(NAMES, Math.floor(seed / 97)),
    personality: pick(TRAITS, Math.floor(seed / 193)),
  }
}

export function createInitialState(seedText) {
  const profile = deterministicProfile(seedText)
  const now = Date.now()
  const statsSeed = `${profile.name}:${profile.species}:${profile.rarity}`
  return {
    version: 3,
    companion: {
      ...profile,
      hatchedAt: now,
      mood: 'calm',
      affection: 1,
      muted: false,
      lastPetAt: now,
      stats: buildStats(statsSeed),
    },
    runtime: {
      lastBubble: `${profile.name} hatched beside your terminal.`,
      lastEventAt: now,
      signalType: 'hatch',
      lastClaudeActivityAt: null,
      claudeActive: false,
      recentTranscriptPath: null,
    },
  }
}

export function petCompanion(state) {
  const now = Date.now()
  const affection = Math.min(999, (state.companion.affection || 0) + 1)
  return {
    ...state,
    companion: {
      ...state.companion,
      affection,
      mood: affection % 5 === 0 ? 'delighted' : 'happy',
      lastPetAt: now,
    },
    runtime: {
      ...state.runtime,
      lastBubble:
        affection % 5 === 0
          ? `${state.companion.name} is thriving.`
          : `${state.companion.name} leans into the head pat.`,
      lastEventAt: now,
      signalType: 'pet',
    },
  }
}

export function toggleMute(state) {
  const muted = !state.companion.muted
  return {
    ...state,
    companion: {
      ...state.companion,
      muted,
    },
    runtime: {
      ...state.runtime,
      lastBubble: muted
        ? `${state.companion.name} curls up for a quiet break.`
        : `${state.companion.name} is back on watch.`,
      lastEventAt: Date.now(),
      signalType: muted ? 'mute' : 'unmute',
    },
  }
}

export function applyObservation(state, observation) {
  const next = {
    ...state,
    runtime: {
      ...state.runtime,
      claudeActive: observation.claudeActive,
      recentTranscriptPath: observation.recentTranscriptPath,
      lastClaudeActivityAt: observation.lastTranscriptMtime
        ? observation.lastTranscriptMtime
        : state.runtime.lastClaudeActivityAt,
      signalType: state.runtime.signalType || 'idle',
    },
  }

  if (state.companion.muted) {
    return next
  }

  if (
    observation.changed &&
    observation.lastTranscriptMtime &&
    observation.recentTranscriptPath
  ) {
    next.runtime.lastBubble = `${state.companion.name} noticed fresh Claude activity.`
    next.runtime.lastEventAt = Date.now()
    next.runtime.signalType = 'transcript'
    next.companion.mood = observation.claudeActive ? 'focused' : 'curious'
  } else if (
    observation.processChanged &&
    observation.claudeActive &&
    !state.runtime.claudeActive
  ) {
    next.runtime.lastBubble = `${state.companion.name} spots Claude Code waking up.`
    next.runtime.lastEventAt = Date.now()
    next.runtime.signalType = 'process_up'
    next.companion.mood = 'alert'
  } else if (
    observation.processChanged &&
    !observation.claudeActive &&
    state.runtime.claudeActive
  ) {
    next.runtime.lastBubble = `${state.companion.name} settles down after the session.`
    next.runtime.lastEventAt = Date.now()
    next.runtime.signalType = 'process_down'
    next.companion.mood = 'calm'
  }

  return next
}

export function getCompanionAccent(state) {
  return SPECIES_COLORS[state.companion.species] || mascotSprite.accent
}

export function getRarityStars(rarity) {
  const count = RARITY_STAR_COUNT[rarity] || 1
  return '★'.repeat(count)
}

export function getCompanionStats(companion) {
  if (companion?.stats) return companion.stats
  const fallbackSeed = `${companion?.name || 'buddy'}:${companion?.species || 'robot'}:${companion?.rarity || 'common'}`
  return buildStats(fallbackSeed)
}

function pickFrame(frames, now, intervalMs) {
  if (!frames?.length) return 'idle'
  const index = Math.floor(now / intervalMs) % frames.length
  return frames[index]
}

export function getSpriteRenderState(state, now = Date.now()) {
  const { companion, runtime } = state
  const recentSignalMs = runtime.lastEventAt ? now - runtime.lastEventAt : Number.POSITIVE_INFINITY

  if (companion.muted) {
    return { variant: 'muted', label: 'resting' }
  }

  if (companion.lastPetAt && now - companion.lastPetAt < 2200) {
    return {
      variant: pickFrame(['pet', 'idle', 'pet', 'focused'], now, 170),
      label: 'happy bounce',
    }
  }

  if (runtime.signalType === 'transcript' && recentSignalMs < 2200) {
    return {
      variant: pickFrame(['blink', 'focused', 'blink', 'focused_lift', 'focused'], now, 140),
      label: 'activity ping',
    }
  }

  if (runtime.signalType === 'process_up' && recentSignalMs < 2600) {
    return {
      variant: pickFrame(
        ['focused_drop', 'focused_lift', 'alert', 'focused_lift', 'focused'],
        now,
        130,
      ),
      label: 'waking up',
    }
  }

  if (runtime.signalType === 'process_down' && recentSignalMs < 2000) {
    return {
      variant: pickFrame(['focused', 'focused_drop', 'idle', 'focused_drop', 'idle'], now, 190),
      label: 'winding down',
    }
  }

  if (runtime.claudeActive || companion.mood === 'alert' || companion.mood === 'focused') {
    return {
      variant: pickFrame(['focused', 'focused', 'focused', 'focused_right', 'focused'], now, 360),
      label: 'watching Claude',
    }
  }

  if (now % 6000 < 500) {
    return { variant: 'blink', label: 'blinking' }
  }

  return { variant: 'idle', label: 'idle' }
}

export function getSpriteVariant(state, now = Date.now()) {
  return getSpriteRenderState(state, now).variant
}

export function getSpriteLines(state, now = Date.now()) {
  const variant = getSpriteVariant(state, now)
  return SPRITE_VARIANTS[variant] || SPRITE_VARIANTS.idle
}
