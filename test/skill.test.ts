import { describe, expect, test } from 'vitest'
import { isParseError, loadSkill } from '../src/skill.js'

describe('loadSkill', () => {
  test('parses a valid skill', () => {
    const s = loadSkill('test/fixtures/good-skill/SKILL.md')
    if (isParseError(s)) throw new Error(s.error)
    expect(s.name).toBe('good-skill')
    expect(s.description).toContain('well-formed skill')
    expect(s.body).toContain('# good-skill')
  })

  test('reports missing frontmatter', () => {
    const s = loadSkill('test/fixtures/does-not-exist.md')
    expect(isParseError(s)).toBe(true)
  })
})
