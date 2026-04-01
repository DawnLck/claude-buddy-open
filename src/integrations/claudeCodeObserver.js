import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects')

function latestTranscriptFile() {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return null

  let latest = null
  for (const projectDir of readdirSync(CLAUDE_PROJECTS_DIR, {
    withFileTypes: true,
  })) {
    if (!projectDir.isDirectory()) continue
    const fullProjectDir = join(CLAUDE_PROJECTS_DIR, projectDir.name)
    for (const entry of readdirSync(fullProjectDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue
      const fullPath = join(fullProjectDir, entry.name)
      const stats = statSync(fullPath)
      if (!latest || stats.mtimeMs > latest.mtimeMs) {
        latest = { path: fullPath, mtimeMs: stats.mtimeMs }
      }
    }
  }

  return latest
}

function readTranscriptSlice(path, startOffset, endOffset) {
  if (endOffset <= startOffset) return ''

  const fd = openSync(path, 'r')
  try {
    const length = endOffset - startOffset
    const buffer = Buffer.alloc(length)
    readSync(fd, buffer, 0, length, startOffset)
    return buffer.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map(item => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      if (typeof item.text === 'string') return item.text
      if (typeof item.content === 'string') return item.content
      if (item.type === 'tool_use' && item.name) return `tool:${item.name}`
      if (item.type === 'tool_result') return 'tool_result'
      return ''
    })
    .filter(Boolean)
    .join(' ')
}

function summarizeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { kind: 'unknown', summary: '' }
  }

  if (entry.type === 'user') {
    const text = extractTextFromContent(entry.message?.content)
    return { kind: 'user', summary: text }
  }

  if (entry.type === 'assistant') {
    const content = entry.message?.content
    const hasToolUse = Array.isArray(content) && content.some(item => item?.type === 'tool_use')
    const text = extractTextFromContent(content)
    return {
      kind: hasToolUse ? 'assistant_tool' : 'assistant',
      summary: text,
    }
  }

  if (entry.type === 'system') {
    return {
      kind: entry.subtype ? `system_${entry.subtype}` : 'system',
      summary: extractTextFromContent(entry.content),
    }
  }

  if (entry.type === 'file-history-snapshot') {
    return { kind: 'snapshot', summary: 'snapshot update' }
  }

  return { kind: String(entry.type || 'unknown'), summary: '' }
}

function readTranscriptDelta(previous, latest) {
  if (!latest?.path) {
    return {
      lastTranscriptSize: null,
      changed: false,
      newEntriesCount: 0,
      latestEventKind: null,
      latestEventSummary: null,
    }
  }

  const stats = statSync(latest.path)
  const size = stats.size
  const previousPath = previous?.recentTranscriptPath || null
  const previousSize = typeof previous?.lastTranscriptSize === 'number' ? previous.lastTranscriptSize : 0
  const resetOffset = previousPath !== latest.path || previousSize > size
  const startOffset = resetOffset ? 0 : previousSize

  if (size === startOffset) {
    return {
      lastTranscriptSize: size,
      changed: false,
      newEntriesCount: 0,
      latestEventKind: previous?.latestEventKind || null,
      latestEventSummary: previous?.latestEventSummary || null,
    }
  }

  const rawSlice = readTranscriptSlice(latest.path, startOffset, size)
  const lines = rawSlice
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const parsedEntries = []
  for (const line of lines) {
    try {
      parsedEntries.push(JSON.parse(line))
    } catch {
      // Ignore partial or malformed lines and keep the observer moving.
    }
  }

  const lastEntry = parsedEntries.at(-1)
  const summary = summarizeEntry(lastEntry)

  return {
    lastTranscriptSize: size,
    changed: parsedEntries.length > 0,
    newEntriesCount: parsedEntries.length,
    latestEventKind: summary.kind,
    latestEventSummary: summary.summary,
  }
}

function isClaudeRunning() {
  try {
    const output = execFileSync('ps', ['-Ao', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .some(
        line => {
          const trimmed = line.trim()
          return (
            trimmed === 'claude' ||
            trimmed.startsWith('claude ') ||
            trimmed.includes('/claude ') ||
            trimmed.endsWith('/claude') ||
            trimmed.includes('node cli.js')
          )
        },
      )
  } catch {
    return false
  }
}

export function observeClaudeCode(previous = {}) {
  const latest = latestTranscriptFile()
  const claudeActive = isClaudeRunning()
  const lastTranscriptMtime = latest?.mtimeMs ?? null
  const recentTranscriptPath = latest?.path ?? null
  const transcriptDelta = readTranscriptDelta(previous, latest)

  return {
    claudeActive,
    lastTranscriptMtime,
    recentTranscriptPath,
    lastTranscriptSize: transcriptDelta.lastTranscriptSize,
    changed: transcriptDelta.changed,
    newEntriesCount: transcriptDelta.newEntriesCount,
    latestEventKind: transcriptDelta.latestEventKind,
    latestEventSummary: transcriptDelta.latestEventSummary,
    processChanged: claudeActive !== previous.claudeActive,
  }
}
