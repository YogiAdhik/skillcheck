import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { isParseError, loadSkill } from './skill.js'

export function initTestFile(skillDir: string): string {
  const dir = resolve(skillDir)
  const skill = loadSkill(join(dir, 'SKILL.md'))
  if (isParseError(skill)) throw new Error(`${skill.path}: ${skill.error}`)
  const name = basename(dir)
  const out = join(dir, 'tests', `${name}.test.yaml`)
  if (existsSync(out)) throw new Error(`${out} already exists`)
  mkdirSync(join(dir, 'tests'), { recursive: true })
  const firstLine = skill.description.split('\n')[0]
  writeFileSync(
    out,
    [
      `# behavioral tests for ${name}`,
      `# description: ${firstLine}`,
      'skill: ..',
      'cases:',
      '  - name: does its job',
      '    prompt: "REPLACE: a prompt that should trigger this skill"',
      '    expect:',
      '      skill_invoked: true',
      '',
    ].join('\n'),
  )
  return out
}
