import { existsSync, readdirSync, statSync } from 'node:fs'
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

function isClaudeRunning() {
  try {
    const output = execFileSync('ps', ['-Ao', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .some(
        line =>
          line.includes(' claude') ||
          line.includes('/claude ') ||
          line.includes('node cli.js'),
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

  return {
    claudeActive,
    lastTranscriptMtime,
    recentTranscriptPath,
    changed:
      lastTranscriptMtime !== null &&
      lastTranscriptMtime !== previous.lastTranscriptMtime,
    processChanged: claudeActive !== previous.claudeActive,
  }
}
