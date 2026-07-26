import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { Adapter } from '../src/adapters/types.js'
import { discoverTestFiles, planTests, reportsPass, runTests } from '../src/runner.js'

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

  test('dry run plans without executing and reflects the cache', async () => {
    const prev = process.cwd()
    process.chdir(root)
    try {
      let spawns = 0
      const countingAdapter: Adapter = {
        name: 'counting',
        async run(opts) {
          spawns++
          return fakeAdapter.run(opts)
        },
      }
      const before = planTests(root)
      expect(before).toHaveLength(2)
      expect(before.every((p) => !p.cached)).toBe(true)
      expect(spawns).toBe(0)

      await runTests(root, { adapter: countingAdapter })
      const ranSpawns = spawns

      const after = planTests(root)
      expect(after).toHaveLength(2)
      expect(after.every((p) => p.cached)).toBe(true)
      expect(after[0].lastCostUsd).toBeCloseTo(0.05)
      expect(spawns).toBe(ranSpawns)

      const otherModel = planTests(root, { model: 'other' })
      expect(otherModel.every((p) => !p.cached)).toBe(true)
    } finally {
      process.chdir(prev)
    }
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
    try {
      const first = await runTests(root, { adapter: fakeAdapter })
      const second = await runTests(root, { adapter: fakeAdapter })
      expect(first.every((r) => !r.cached)).toBe(true)
      expect(second.every((r) => r.cached)).toBe(true)
    } finally {
      process.chdir(initialCwd)
    }
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

  test('model changes bust the cache', async () => {
    const modelRoot = await mkdtemp(join(tmpdir(), 'skillcheck-model-cache-'))
    await mkdir(join(modelRoot, 'my-skill'))
    await writeFile(
      join(modelRoot, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: Use when testing the runner end to end.\n---\n\nbody\n',
    )
    await writeFile(
      join(modelRoot, 'my-skill.test.yaml'),
      [
        'skill: my-skill',
        'cases:',
        '  - name: invokes and runs git',
        '    prompt: "do it"',
        '    expect:',
        '      skill_invoked: true',
      ].join('\n'),
    )
    process.chdir(modelRoot)
    try {
      const first = await runTests(modelRoot, { adapter: fakeAdapter, model: 'haiku' })
      const second = await runTests(modelRoot, { adapter: fakeAdapter, model: 'haiku' })
      const third = await runTests(modelRoot, { adapter: fakeAdapter, model: 'other' })
      expect(first.every((r) => !r.cached)).toBe(true)
      expect(second.every((r) => r.cached)).toBe(true)
      expect(third.every((r) => !r.cached)).toBe(true)
    } finally {
      process.chdir(initialCwd)
      await rm(modelRoot, { recursive: true, force: true })
    }
  })

  test('fixture edits bust the cache', async () => {
    const fixRoot = await mkdtemp(join(tmpdir(), 'skillcheck-fixture-cache-'))
    await mkdir(join(fixRoot, 'my-skill'))
    await writeFile(
      join(fixRoot, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: Use when testing the runner end to end.\n---\n\nbody\n',
    )
    await mkdir(join(fixRoot, 'fixture'))
    await writeFile(join(fixRoot, 'fixture', 'input.txt'), 'v1')
    await writeFile(
      join(fixRoot, 'my-skill.test.yaml'),
      [
        'skill: my-skill',
        'cases:',
        '  - name: invokes and runs git',
        '    prompt: "do it"',
        '    setup: fixture',
        '    expect:',
        '      skill_invoked: true',
      ].join('\n'),
    )
    process.chdir(fixRoot)
    try {
      const first = await runTests(fixRoot, { adapter: fakeAdapter })
      const second = await runTests(fixRoot, { adapter: fakeAdapter })
      expect(first.every((r) => !r.cached)).toBe(true)
      expect(second.every((r) => r.cached)).toBe(true)
      await writeFile(join(fixRoot, 'fixture', 'input.txt'), 'v2')
      const third = await runTests(fixRoot, { adapter: fakeAdapter })
      expect(third.every((r) => !r.cached)).toBe(true)
    } finally {
      process.chdir(initialCwd)
      await rm(fixRoot, { recursive: true, force: true })
    }
  })

  test('judge cost counts toward spend and the report', async () => {
    const judgeRoot = await mkdtemp(join(tmpdir(), 'skillcheck-judge-'))
    try {
      await mkdir(join(judgeRoot, 'my-skill'))
      await writeFile(
        join(judgeRoot, 'my-skill', 'SKILL.md'),
        '---\nname: my-skill\ndescription: Use when testing the runner end to end.\n---\n\nbody\n',
      )
      await writeFile(
        join(judgeRoot, 'my-skill.test.yaml'),
        [
          'skill: my-skill',
          'cases:',
          '  - name: judged case',
          '    prompt: "do it"',
          '    expect:',
          '      skill_invoked: true',
          '    judge: "score it"',
        ].join('\n'),
      )
      const judgeAdapter: Adapter = {
        name: 'fake-judge',
        async run() {
          return {
            messages: ['{"score": 9, "reasoning": "fine"}'],
            toolCalls: [{ name: 'Skill', input: {} }],
            commands: [],
            result: { costUsd: 0.05, numTurns: 1, isError: false },
          }
        },
      }
      const reports = await runTests(judgeRoot, { adapter: judgeAdapter, cache: false })
      expect(reports).toHaveLength(1)
      expect(reports[0].checks.every((c) => c.pass)).toBe(true)
      expect(reports[0].verdict?.pass).toBe(true)
      expect(reports[0].costUsd).toBeCloseTo(0.1)
    } finally {
      await rm(judgeRoot, { recursive: true, force: true })
    }
  })
})
