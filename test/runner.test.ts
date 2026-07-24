import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { Adapter } from '../src/adapters/types.js'
import { discoverTestFiles, reportsPass, runTests } from '../src/runner.js'

let root: string
const initialCwd = process.cwd()

const fakeAdapter: Adapter = {
  name: 'fake',
  async run() {
    return {
      messages: ['done'],
      toolCalls: [{ name: 'Skill', input: {} }],
      commands: ['git status'],
      result: { costUsd: 0.05, numTurns: 2, isError: false },
    }
  },
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skillcheck-runner-'))
  await mkdir(join(root, 'my-skill'))
  await writeFile(
    join(root, 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Use when testing the runner end to end.\n---\n\nbody\n',
  )
  await writeFile(
    join(root, 'my-skill.test.yaml'),
    [
      'skill: my-skill',
      'cases:',
      '  - name: invokes and runs git',
      '    prompt: "do it"',
      '    expect:',
      '      skill_invoked: true',
      '      command_ran: "git status"',
      '  - name: expects a command that never runs',
      '    prompt: "do it differently"',
      '    expect:',
      '      command_ran: "npm publish"',
    ].join('\n'),
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('runner', () => {
  test('discovers test files', () => {
    expect(discoverTestFiles(root)).toHaveLength(1)
  })

  test('runs cases against the adapter and reports per-check results', async () => {
    const reports = await runTests(root, { adapter: fakeAdapter, cache: false })
    expect(reports).toHaveLength(2)
    expect(reports[0].checks.every((c) => c.pass)).toBe(true)
    expect(reports[1].checks.some((c) => !c.pass)).toBe(true)
    expect(reportsPass(reports)).toBe(false)
  })

  test('budget stops later cases', async () => {
    const reports = await runTests(root, { adapter: fakeAdapter, cache: false, budgetUsd: 0.01 })
    expect(reports[1].error).toContain('budget')
  })

  test('second run with cache is free', async () => {
    process.chdir(root)
    const first = await runTests(root, { adapter: fakeAdapter })
    const second = await runTests(root, { adapter: fakeAdapter })
    expect(first.every((r) => !r.cached)).toBe(true)
    expect(second.every((r) => r.cached)).toBe(true)
  })

  test('cache write failure does not fail the case', async () => {
    const blockRoot = await mkdtemp(join(tmpdir(), 'skillcheck-cacheblock-'))
    await writeFile(join(blockRoot, '.skillcheck'), '')
    process.chdir(blockRoot)
    try {
      const reports = await runTests(root, { adapter: fakeAdapter })
      expect(reports).toHaveLength(2)
      expect(reports.every((r) => !r.cached)).toBe(true)
      expect(reports[0].checks.every((c) => c.pass)).toBe(true)
      expect(reports.every((r) => !r.error || r.error.includes('budget'))).toBe(true)
    } finally {
      process.chdir(initialCwd)
      await rm(blockRoot, { recursive: true, force: true })
    }
  })

  test('discoverTestFiles throws a plain error on a missing path', () => {
    expect(() => discoverTestFiles('no-such-dir-xyz')).toThrow()
  })
})
