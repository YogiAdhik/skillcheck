import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runTests } from '../src/runner.js'

const live = !!process.env.SKILLCHECK_E2E

describe.skipIf(!live)('live smoke', () => {
  test('runs a trivial skill against the real agent', { timeout: 600_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'skillcheck-e2e-'))
    try {
      await mkdir(join(root, 'greeter'))
      await writeFile(
        join(root, 'greeter', 'SKILL.md'),
        '---\nname: greeter\ndescription: Use when the user asks to write a greeting file.\n---\n\nWrite the single word "hello" into a file named greeting.txt in the working directory.\n',
      )
      await writeFile(
        join(root, 'greeter.test.yaml'),
        [
          'skill: greeter',
          'cases:',
          '  - name: writes the greeting file',
          '    prompt: "write the greeting file"',
          '    expect:',
          '      files_changed: ["greeting.txt"]',
        ].join('\n'),
      )
      const reports = await runTests(root, { cache: false, model: 'haiku' })
      expect(reports).toHaveLength(1)
      expect(reports[0].error).toBeUndefined()
      expect(reports[0].checks[0].pass).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
