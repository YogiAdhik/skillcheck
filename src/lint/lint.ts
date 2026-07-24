import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isParseError, loadSkill } from '../skill.js'
import { allRules, type Finding } from './rules.js'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist'])

export function discoverSkillFiles(path: string): string[] {
  if (!existsSync(path)) throw new Error(`${path}: no such file or directory`)
  if (statSync(path).isFile()) return [path]
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name))
      else if (entry.isFile() && entry.name === 'SKILL.md') found.push(join(dir, entry.name))
    }
  }
  walk(path)
  return found.sort()
}

export function lintPath(path: string): Finding[] {
  const findings: Finding[] = []
  for (const file of discoverSkillFiles(path)) {
    const skill = loadSkill(file)
    if (isParseError(skill)) {
      findings.push({ rule: 'parse', severity: 'error', message: skill.error, file })
      continue
    }
    for (const rule of allRules) findings.push(...rule(skill))
  }
  return findings
}
