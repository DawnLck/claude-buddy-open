import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import {
  applyObservation,
  getCompanionAccent,
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

function Meter({ value, max = 12, color = 'green' }) {
  const normalized = Math.max(0, Math.min(max, value))
  const filled = '■'.repeat(normalized)
  const empty = '·'.repeat(Math.max(0, max - normalized))
  return h(
    Box,
    null,
    h(Text, { color }, filled),
    h(Text, { dimColor: true }, empty),
  )
}

function SpritePanel({ state, now }) {
  const accent = getCompanionAccent(state)
  const lines = getSpriteLines(state, now)
  const renderState = getSpriteRenderState(state, now)
  const label = renderState.label || 'idle'

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
    ...lines.map((line, index) =>
      h(Text, { key: `${index}:${line}`, color: accent }, line),
    ),
    h(Text, { dimColor: true }, label),
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
  const affectionLevel = Math.min(12, Math.max(1, Math.round(companion.affection)))
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
            borderStyle: 'round',
            borderColor: 'cyan',
            paddingX: 1,
            flexDirection: 'column',
          },
          h(Text, { bold: true, color: 'cyan' }, 'Claude Buddy'),
          h(Text, { bold: true }, companion.personality),
          h(Text, { dimColor: true }, `Hatched ${formatRelativeTime(companion.hatchedAt)}`),
          h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'Affection')), 
          h(Meter, { value: affectionLevel, color: 'magenta' }),
          h(StatusLine, {
            label: 'Mood',
            value: companion.mood,
            color: 'yellow',
          }),
          h(StatusLine, {
            label: 'Rarity',
            value: companion.rarity,
            color: 'green',
          }),
          h(StatusLine, {
            label: 'Muted',
            value: companion.muted ? 'yes' : 'no',
            color: companion.muted ? 'red' : 'green',
          }),
          h(StatusLine, {
            label: 'Last Pet',
            value: formatRelativeTime(companion.lastPetAt),
          }),
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
          h(StatusLine, { label: 'Transcript', value: transcriptLabel }),
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
