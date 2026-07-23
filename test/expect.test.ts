import { describe, expect, test } from 'vitest'
import { checkExpectations, type WorkspaceDiff } from '../src/expect.js'
import type { Transcript } from '../src/transcript.js'

const transcript: Transcript = {
  messages: ['fix: parser', 'Done. I committed the staged changes.'],
  toolCalls: [
    { name: 'Skill', input: { skill: 'commit-helper' } },
    { name: 'Bash', input: { command: 'git commit -m "fix: parser"' } },
  ],
  commands: ['git commit -m "fix: parser"'],
}

const cleanDiff: WorkspaceDiff = { changed: [], created: [], deleted: [] }

describe('checkExpectations', () => {
  test('passes when everything matches', () => {
    const checks = checkExpectations(
      {
        files_changed: [],
        command_ran: 'git commit',
        transcript_matches: '^(feat|fix|chore)',
        skill_invoked: true,
      },
      transcript,
      cleanDiff,
    )
    expect(checks).toHaveLength(4)
    expect(checks.every((c) => c.pass)).toBe(true)
  })

  test('fails on unexpected file changes', () => {
    const checks = checkExpectations({ files_changed: [] }, transcript, {
      changed: ['src/app.ts'],
      created: [],
      deleted: [],
    })
    expect(checks[0].pass).toBe(false)
    expect(checks[0].detail).toContain('src/app.ts')
  })

  test('fails when the skill never fired', () => {
    const bare: Transcript = { messages: [], toolCalls: [], commands: [] }
    const checks = checkExpectations({ skill_invoked: true }, bare, cleanDiff)
    expect(checks[0].pass).toBe(false)
  })

  test('only declared expectations produce checks', () => {
    expect(checkExpectations({}, transcript, cleanDiff)).toHaveLength(0)
  })
})
