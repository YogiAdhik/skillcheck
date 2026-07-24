import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  test('nested skills under a root skill are all found', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skillcheck-nested-'))
    try {
      await writeFile(
        join(root, 'SKILL.md'),
        '---\nname: root-skill\ndescription: Root skill with nested subskills.\n---\n\nroot body\n',
      )
      await mkdir(join(root, 'sub-skill'))
      await writeFile(
        join(root, 'sub-skill', 'SKILL.md'),
        '---\nname: sub-skill\ndescription: Nested subskill.\n---\n\nsub body\n',
      )
      const files = discoverSkillFiles(root)
      expect(files).toHaveLength(2)
      expect(files.some((f) => f.endsWith('SKILL.md'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('lintPath aggregates findings across skills', () => {
    const findings = lintPath('test/fixtures')
    expect(findings.some((f) => f.file.includes('bad-skill'))).toBe(true)
    expect(findings.some((f) => f.file.includes('good-skill'))).toBe(false)
  })

  test('nonexistent path throws a plain error', () => {
    expect(() => discoverSkillFiles('test/fixtures/nope-does-not-exist')).toThrow('no such file')
  })
})
