import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import {
  applyObservation,
  COMPANION_STAT_KEYS,
  getCompanionStats,
  getCompanionAccent,
  getRarityStars,
  getSpriteLines,
  getSpriteRenderState,
  petCompanion,
  toggleMute,
} from '../core/companion.js'
import { loadState, saveState } from '../core/storage.js'
import { observeClaudeCode } from '../integrations/claudeCodeObserver.js'

const h = React.createElement

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'never'
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

function StatusLine({ label, value, color = 'white' }) {
  return h(
    Box,
    null,
    h(Text, { dimColor: true }, `${label}: `),
    h(Text, { color }, value),
  )
}

function shortenMiddle(text, maxLength = 42) {
  if (!text || text.length <= maxLength) return text
  const side = Math.max(8, Math.floor((maxLength - 3) / 2))
  return `${text.slice(0, side)}...${text.slice(-side)}`
}

function buildStatBar(value, width = 12) {
  const clamped = Math.max(0, Math.min(99, Number(value) || 0))
  const filled = Math.round((clamped / 99) * width)
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

function formatSpeciesLabel(species) {
  return (species || 'buddy').toUpperCase()
}

function StatsPanel({ companion, accent }) {
  const stats = getCompanionStats(companion)
  const rows = COMPANION_STAT_KEYS.map(key => ({
    key,
    label: key.toUpperCase(),
    value: stats[key] || 0,
  }))

  return h(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    ...rows.map(row =>
      h(
        Box,
        { key: row.key },
        h(Text, { dimColor: true }, `${row.label.padEnd(10, ' ')}`),
        h(Text, { color: accent }, ` ${buildStatBar(row.value)} `),
        h(Text, { color: 'white' }, `${String(row.value).padStart(2, ' ')}`),
      ),
    ),
  )
}

function buildCodingRigLines(now, active) {
  const frame = Math.floor(now / 170) % 4
  const cursorFrames = ['_', '|', '_', ' ']
  const keyFrames = ['== == ==', '== .. ==', '.. == ..', '== == ==']
  const cursor = active ? cursorFrames[frame] : ' '
  const keys = active ? keyFrames[frame] : '.. .. ..'

  return [
    ' .------. ',
    ` |code${cursor}| `,
    ' |______| ',
    ` / ${keys} \\`,
  ]
}

function getCodingRigState(state, now) {
  const runtime = state.runtime || {}
  const signalType = runtime.signalType || 'idle'
  const recentSignalMs = runtime.lastEventAt ? now - runtime.lastEventAt : Number.POSITIVE_INFINITY

  if (state.companion.muted) {
    return { visible: false }
  }

  if (runtime.claudeActive) {
    const lines = buildCodingRigLines(now, true)
    return { visible: true, lines, color: 'cyan', suffix: '+ coding' }
  }

  if (signalType === 'process_up' && recentSignalMs < 1800) {
    const lines = buildCodingRigLines(now, true)
    return { visible: true, lines, color: 'blue', suffix: '+ booting' }
  }

  if (signalType === 'process_down' && recentSignalMs < 1600) {
    const phase = Math.floor(recentSignalMs / 400)
    const shutdownFrames = [
      ['  .------. ', '  |code_| ', '  |______| ', ' / .. == .. \\'],
      ['  .------. ', '  |code | ', '  |______| ', ' / .. .. .. \\'],
      ['  .------. ', '  |    _| ', '  |______| ', ' / .. .. .. \\'],
      ['  .------. ', '  |_____| ', '  |______| ', ' / ....... \\'],
    ]
    const lines = shutdownFrames[Math.min(phase, shutdownFrames.length - 1)]
    return { visible: true, lines, color: 'gray', suffix: '+ shutting down' }
  }

  return { visible: false }
}

function SpritePanel({ state, now }) {
  const accent = getCompanionAccent(state)
  const lines = getSpriteLines(state, now)
  const renderState = getSpriteRenderState(state, now)
  const rig = getCodingRigState(state, now)
  const label = `${renderState.label || 'idle'} ${rig.suffix || ''}`.trim()

  return h(
    Box,
    {
      borderStyle: 'round',
      borderColor: accent,
      paddingX: 1,
      flexDirection: 'column',
      minWidth: 18,
    },
    h(Text, { bold: true, color: accent }, state.companion.name),
    h(Text, { dimColor: true }, `${state.companion.species} companion`),
    h(
      Box,
      {
        flexDirection: 'row',
        alignItems: 'flex-end',
      },
      rig.visible
        ? h(
            Box,
            { flexDirection: 'column' },
            ...rig.lines.map((line, index) =>
              h(Text, { key: `rig:${index}:${line}`, color: rig.color || 'cyan' }, line),
            ),
          )
        : null,
      h(
        Box,
        { flexDirection: 'column', marginLeft: rig.visible ? 0 : 0 },
        ...lines.map((line, index) =>
          h(Text, { key: `${index}:${line}`, color: accent }, line),
        ),
      ),
    ),
    h(Text, { dimColor: true }, label),
  )
}

function ProfileCard({ state }) {
  const accent = getCompanionAccent(state)
  const { companion } = state
  const stars = getRarityStars(companion.rarity)

  return h(
    Box,
    {
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingX: 1,
      flexDirection: 'column',
    },
    h(
      Box,
      { justifyContent: 'space-between' },
      h(Text, { bold: true, color: accent }, `${stars} ${companion.rarity.toUpperCase()}`),
      h(Text, { bold: true, color: 'blue' }, formatSpeciesLabel(companion.species)),
    ),
    h(Text, { bold: true, color: 'white' }, companion.name),
    h(Text, { dimColor: true, italic: true }, `"${companion.personality}"`),
    h(StatsPanel, { companion, accent }),
  )
}

export function BuddyApp() {
  const { exit } = useApp()
  const [state, setState] = useState(() => loadState())
  const [observation, setObservation] = useState(() =>
    observeClaudeCode({
      lastTranscriptMtime: null,
      claudeActive: false,
    }),
  )

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit()
      return
    }

    if (input === 'p') {
      setState(current => {
        const next = petCompanion(current)
        saveState(next)
        return next
      })
      return
    }

    if (input === 'r') {
      setObservation(current => observeClaudeCode(current))
      return
    }

    if (input === 'm') {
      setState(current => {
        const next = toggleMute(current)
        saveState(next)
        return next
      })
    }
  })

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now())
    }, 350)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setObservation(current => observeClaudeCode(current))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setState(current => {
      const next = applyObservation(current, observation)
      if (next !== current) saveState(next)
      return next
    })
  }, [observation])

  const { companion, runtime } = state
  const transcriptLabel = runtime.recentTranscriptPath
    ? shortenMiddle(runtime.recentTranscriptPath.split('/').slice(-2).join('/'))
    : 'none'
  const terminalWidth = process.stdout.columns || 100
  const compact = terminalWidth < 92
  const activityLabel = runtime.claudeActive ? 'active' : 'idle'
  const bubble = runtime.lastBubble || `${companion.name} is keeping quiet.`

  return h(
    Box,
    { flexDirection: 'column', padding: 1 },
    h(
      Box,
      { flexDirection: compact ? 'column' : 'row' },
      h(SpritePanel, { state, now }),
      h(
        Box,
        {
          flexDirection: 'column',
          marginLeft: compact ? 0 : 1,
          marginTop: compact ? 1 : 0,
          flexGrow: 1,
        },
        h(
          Box,
          {
            flexDirection: 'column',
          },
          h(ProfileCard, { state }),
          h(
            Box,
            { marginTop: 1, borderStyle: 'round', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
            h(StatusLine, {
              label: 'Mood',
              value: companion.mood,
              color: 'yellow',
            }),
            h(StatusLine, {
              label: 'Affection',
              value: String(companion.affection),
              color: 'magenta',
            }),
            h(StatusLine, {
              label: 'Muted',
              value: companion.muted ? 'yes' : 'no',
              color: companion.muted ? 'red' : 'green',
            }),
            h(StatusLine, {
              label: 'Hatched',
              value: formatRelativeTime(companion.hatchedAt),
            }),
          ),
        ),
        h(
          Box,
          {
            marginTop: 1,
            borderStyle: 'round',
            borderColor: 'blue',
            paddingX: 1,
            flexDirection: 'column',
          },
          h(Text, { bold: true, color: 'blue' }, 'Claude Code Observer'),
          h(StatusLine, {
            label: 'Process',
            value: activityLabel,
            color: runtime.claudeActive ? 'green' : 'gray',
          }),
          h(StatusLine, {
            label: 'Signal',
            value:
              observation.changed
                ? 'fresh transcript activity'
                : observation.processChanged
                  ? 'process state changed'
                  : 'watching quietly',
            color: observation.changed || observation.processChanged ? 'cyan' : 'gray',
          }),
          h(StatusLine, {
            label: 'Transcript',
            value: transcriptLabel,
          }),
          h(StatusLine, {
            label: 'Last Activity',
            value: formatRelativeTime(runtime.lastClaudeActivityAt),
          }),
        ),
      ),
    ),
    h(
      Box,
      {
        marginTop: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        paddingX: 1,
        flexDirection: 'column',
      },
      h(Text, { bold: true, color: 'yellow' }, 'Bubble'),
      h(Text, null, bubble),
      h(Text, { dimColor: true }, `Last event ${formatRelativeTime(runtime.lastEventAt)}`),
    ),
    h(
      Box,
      { marginTop: 1 },
      h(
        Text,
        { dimColor: true },
        'Keys: p pet, m mute/unmute, r refresh observer, q quit',
      ),
    ),
  )
}
