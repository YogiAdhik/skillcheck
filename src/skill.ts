import { readFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import YAML from 'yaml'

export interface SkillFile {
  path: string
  dir: string
  name: string
  description: string
  frontmatter: Record<string, unknown>
  body: string
  raw: string
}

export interface SkillParseError {
  path: string
  error: string
}

export function loadSkill(path: string): SkillFile | SkillParseError {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return { path, error: 'cannot read file' }
  }
  if (!raw.startsWith('---')) return { path, error: 'missing frontmatter' }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { path, error: 'unterminated frontmatter' }
  let fm: Record<string, unknown>
  try {
    fm = YAML.parse(raw.slice(3, end)) ?? {}
  } catch (e) {
    return { path, error: `bad yaml in frontmatter: ${(e as Error).message}` }
  }
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1)
  return {
    path,
    dir: dirname(path),
    name: typeof fm.name === 'string' ? fm.name : basename(dirname(path)),
    description: typeof fm.description === 'string' ? fm.description : '',
    frontmatter: fm,
    body,
    raw,
  }
}

export function isParseError(s: SkillFile | SkillParseError): s is SkillParseError {
  return 'error' in s
}
