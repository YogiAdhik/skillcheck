import { describe, expect, test } from 'vitest'
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
