import { describe, expect, test } from 'vitest'
import { isParseError, loadSkill, type SkillFile } from '../src/skill.js'
import {
  dangerousPatterns,
  descriptionQuality,
  frontmatterFields,
  relativeLinks,
  tokenBudget,
} from '../src/lint/rules.js'

function fixture(name: string): SkillFile {
  const s = loadSkill(`test/fixtures/${name}/SKILL.md`)
  if (isParseError(s)) throw new Error(s.error)
  return s
}

describe('lint rules', () => {
  test('good skill is clean', () => {
    const s = fixture('good-skill')
    expect(frontmatterFields(s)).toHaveLength(0)
    expect(descriptionQuality(s)).toHaveLength(0)
    expect(relativeLinks(s)).toHaveLength(0)
    expect(dangerousPatterns(s)).toHaveLength(0)
  })

  test('missing description is an error', () => {
    const findings = frontmatterFields(fixture('bad-skill'))
    expect(findings.some((f) => f.severity === 'error' && f.message.includes('description'))).toBe(true)
  })

  test('broken relative link is caught', () => {
    const findings = relativeLinks(fixture('bad-skill'))
    expect(findings.some((f) => f.message.includes('does-not-exist.md'))).toBe(true)
  })

  test('dangerous patterns are flagged', () => {
    const messages = dangerousPatterns(fixture('bad-skill')).map((f) => f.message)
    expect(messages.some((m) => m.includes('sudo'))).toBe(true)
    expect(messages.some((m) => m.includes('curl'))).toBe(true)
  })

  test('token budget warns on huge skills', () => {
    const s = fixture('good-skill')
    const huge = { ...s, raw: 'x'.repeat(50_000) }
    expect(tokenBudget(huge)).toHaveLength(1)
    expect(tokenBudget(s)).toHaveLength(0)
  })
})
