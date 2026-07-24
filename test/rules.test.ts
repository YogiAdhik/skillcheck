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

  test('templated links are not judged', () => {
    const s = fixture('good-skill')
    const body = '[ref]({baseDir}/references/foo.md) and [broken](really-gone.md)'
    const findings = relativeLinks({ ...s, body })
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('really-gone.md')
  })

  test('links inside code blocks and inline code are ignored', () => {
    const s = fixture('good-skill')
    const body = [
      'Example usage:',
      '```',
      '![chart](data.png){width=full}',
      '[doc](missing.md)',
      '```',
      'And inline: `[ref](also-missing.md)` stays example-only.',
      '[really broken](truly-absent.md)',
    ].join('\n')
    const findings = relativeLinks({ ...s, body })
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('truly-absent.md')
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

  test('description quality warning branches', () => {
    const s = fixture('good-skill')

    // Branch 1: description under 20 chars (with trigger language to avoid other warnings)
    const shortDesc = { ...s, description: 'Use when short' }
    const shortFindings = descriptionQuality(shortDesc)
    expect(shortFindings).toHaveLength(1)
    expect(shortFindings[0].message).toContain('20 chars')

    // Branch 2: description over 1000 chars (with trigger language to avoid other warnings)
    const longDesc = { ...s, description: 'Use when testing. ' + 'x'.repeat(1200) }
    const longFindings = descriptionQuality(longDesc)
    expect(longFindings).toHaveLength(1)
    expect(longFindings[0].message).toContain('1000 chars')

    // Branch 3: description lacking trigger language (sufficient length to avoid other warnings)
    const noTriggerDesc = { ...s, description: 'A simple description without special words that is long enough.' }
    const noTriggerFindings = descriptionQuality(noTriggerDesc)
    expect(noTriggerFindings).toHaveLength(1)
    expect(noTriggerFindings[0].message).toContain('trigger language')
  })
})
