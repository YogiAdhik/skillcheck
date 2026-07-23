import { describe, expect, test } from 'vitest'
import { discoverSkillFiles, lintPath } from '../src/lint/lint.js'

describe('lint', () => {
  test('discovers SKILL.md files under a directory', () => {
    const files = discoverSkillFiles('test/fixtures')
    expect(files.length).toBeGreaterThanOrEqual(2)
    expect(files.every((f) => f.endsWith('SKILL.md'))).toBe(true)
  })

  test('a single skill dir resolves to its SKILL.md', () => {
    expect(discoverSkillFiles('test/fixtures/good-skill')).toHaveLength(1)
  })

  test('lintPath aggregates findings across skills', () => {
    const findings = lintPath('test/fixtures')
    expect(findings.some((f) => f.file.includes('bad-skill'))).toBe(true)
    expect(findings.some((f) => f.file.includes('good-skill'))).toBe(false)
  })
})
