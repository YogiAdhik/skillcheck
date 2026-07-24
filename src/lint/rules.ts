import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SkillFile } from '../skill.js'

export interface Finding {
  rule: string
  severity: 'error' | 'warning'
  message: string
  file: string
}

export type Rule = (skill: SkillFile) => Finding[]

function finding(s: SkillFile, rule: string, severity: Finding['severity'], message: string): Finding {
  return { rule, severity, message, file: s.path }
}

export const frontmatterFields: Rule = (s) => {
  const out: Finding[] = []
  if (typeof s.frontmatter.name !== 'string' || !s.frontmatter.name.trim())
    out.push(finding(s, 'frontmatter-fields', 'error', 'frontmatter is missing a name'))
  if (!s.description.trim())
    out.push(finding(s, 'frontmatter-fields', 'error', 'frontmatter is missing a description'))
  return out
}

export const descriptionQuality: Rule = (s) => {
  const d = s.description.trim()
  if (!d) return []
  const out: Finding[] = []
  if (d.length < 20)
    out.push(finding(s, 'description-quality', 'warning', 'description under 20 chars; unlikely to trigger reliably'))
  if (d.length > 1000)
    out.push(finding(s, 'description-quality', 'warning', 'description over 1000 chars; gets truncated in listings'))
  if (!/\b(use|when|for|trigger)\b/i.test(d))
    out.push(finding(s, 'description-quality', 'warning', 'description has no trigger language ("use when ...") — the agent decides from this text alone'))
  return out
}

export const tokenBudget: Rule = (s) => {
  const tokens = Math.round(s.raw.length / 4)
  if (tokens > 10_000)
    return [finding(s, 'token-budget', 'warning', `skill is roughly ${tokens} tokens; every invocation pays this cost`)]
  return []
}

// links inside fenced blocks or inline code are examples, not references
function proseOnly(body: string): string {
  const kept: string[] = []
  let inFence = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence) kept.push(line)
  }
  return kept.join('\n').replace(/`[^`\n]*`/g, '')
}

export const relativeLinks: Rule = (s) => {
  const out: Finding[] = []
  for (const m of proseOnly(s.body).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = m[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    // templated targets like {baseDir}/x.md resolve at runtime; can't judge them
    if (target.includes('{')) continue
    if (!existsSync(resolve(s.dir, target.split('#')[0])))
      out.push(finding(s, 'relative-links', 'error', `broken relative link: ${target}`))
  }
  return out
}

const DANGEROUS = [
  { re: /rm\s+-rf\s+[~/]/, why: 'destructive rm -rf on a home or root path' },
  { re: /curl[^\n|]*\|\s*(ba)?sh/, why: 'pipes curl to a shell' },
  { re: /--dangerously-skip-permissions/, why: 'tells the agent to skip permission prompts' },
  { re: /\bsudo\b/, why: 'asks for sudo' },
]

export const dangerousPatterns: Rule = (s) => {
  const out: Finding[] = []
  for (const { re, why } of DANGEROUS)
    if (re.test(s.body)) out.push(finding(s, 'dangerous-patterns', 'warning', why))
  return out
}

export const allRules: Rule[] = [frontmatterFields, descriptionQuality, tokenBudget, relativeLinks, dangerousPatterns]
