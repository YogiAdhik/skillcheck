import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { buildArgs, claudeCode } from '../src/adapters/claude-code.js'

describe('claude code adapter', () => {
  test('builds headless args', () => {
    const args = buildArgs({ prompt: 'do the thing', cwd: '/tmp/x', model: 'haiku' })
    expect(args).toContain('-p')
    expect(args).toContain('do the thing')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--dangerously-skip-permissions')
    expect(args).toContain('--model')
    expect(args).toContain('haiku')
  })

  test('model is omitted unless given', () => {
    const args = buildArgs({ prompt: 'x', cwd: '/tmp/x' })
    expect(args).not.toContain('--model')
  })

  test('adapter is named', () => {
    expect(claudeCode.name).toBe('claude-code')
  })
})

describe('claude code adapter run()', () => {
  let binDir: string
  let originalPath: string | undefined
  let originalFake: string | undefined

  beforeAll(() => {
    binDir = mkdtempSync(join(tmpdir(), 'skillcheck-fake-claude-'))

    writeFileSync(
      join(binDir, 'claude'),
      `#!/bin/sh
case "$SKILLCHECK_FAKE" in
  ok)
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}'
    echo '{"type":"result","subtype":"success","total_cost_usd":0.01,"num_turns":1,"is_error":false}'
    ;;
  fail) echo boom >&2; exit 3 ;;
  hang) sleep 5 ;;
esac
`,
    )
    chmodSync(join(binDir, 'claude'), 0o755)

    writeFileSync(
      join(binDir, 'claude.cmd'),
      `@echo off
if "%SKILLCHECK_FAKE%"=="ok" (
  echo {"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}
  echo {"type":"result","subtype":"success","total_cost_usd":0.01,"num_turns":1,"is_error":false}
  exit /b 0
)
if "%SKILLCHECK_FAKE%"=="fail" (
  echo boom 1>&2
  exit /b 3
)
if "%SKILLCHECK_FAKE%"=="hang" (
  ping -n 6 127.0.0.1 >nul
  exit /b 0
)
`,
    )

    originalPath = process.env.PATH
    originalFake = process.env.SKILLCHECK_FAKE
    process.env.PATH = `${binDir}${delimiter}${originalPath ?? ''}`
  })

  afterAll(() => {
    process.env.PATH = originalPath
    if (originalFake === undefined) delete process.env.SKILLCHECK_FAKE
    else process.env.SKILLCHECK_FAKE = originalFake
    rmSync(binDir, { recursive: true, force: true })
  })

  test('resolves with parsed transcript on success', async () => {
    process.env.SKILLCHECK_FAKE = 'ok'
    const transcript = await claudeCode.run({ prompt: 'hi', cwd: process.cwd() })
    expect(transcript.messages).toEqual(['hi'])
    expect(transcript.result?.costUsd).toBeCloseTo(0.01)
  })

  test('rejects with exit code on nonzero exit and empty stdout', async () => {
    process.env.SKILLCHECK_FAKE = 'fail'
    await expect(claudeCode.run({ prompt: 'hi', cwd: process.cwd() })).rejects.toThrow('exited 3')
  })

  test('rejects on timeout without waiting for the process to exit', async () => {
    process.env.SKILLCHECK_FAKE = 'hang'
    const start = Date.now()
    await expect(claudeCode.run({ prompt: 'hi', cwd: process.cwd(), timeoutMs: 300 })).rejects.toThrow('timed out')
    expect(Date.now() - start).toBeLessThan(2000)
  })
})
