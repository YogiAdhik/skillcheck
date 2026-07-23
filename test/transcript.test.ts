import { describe, expect, test } from 'vitest'
import { parseStreamJson } from '../src/transcript.js'

const SAMPLE = [
  '{"type":"system","subtype":"init","session_id":"abc"}',
  '{"type":"assistant","message":{"content":[{"type":"text","text":"Committing the staged changes."}]}}',
  '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"commit-helper"}}]}}',
  '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"git commit -m \\"fix: parser\\""}}]}}',
  'not json noise',
  '{"type":"result","subtype":"success","total_cost_usd":0.0123,"num_turns":3,"is_error":false}',
].join('\n')

describe('parseStreamJson', () => {
  test('extracts messages, tool calls, commands, result', () => {
    const t = parseStreamJson(SAMPLE)
    expect(t.messages).toEqual(['Committing the staged changes.'])
    expect(t.toolCalls.map((c) => c.name)).toEqual(['Skill', 'Bash'])
    expect(t.commands).toEqual(['git commit -m "fix: parser"'])
    expect(t.result?.costUsd).toBeCloseTo(0.0123)
    expect(t.result?.isError).toBe(false)
  })

  test('tolerates empty output', () => {
    const t = parseStreamJson('')
    expect(t.messages).toEqual([])
    expect(t.result).toBeUndefined()
  })

  test('tolerates malformed events and missing fields', () => {
    const t = parseStreamJson(
      [
        '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{}}]}}',
        '{"type":"assistant","message":{}}',
        '{"type":"assistant"}',
        '{"type":"result","subtype":"success"}',
      ].join('\n'),
    )
    expect(t.toolCalls).toEqual([])
    expect(t.messages).toEqual([])
    expect(t.result).toEqual({ costUsd: 0, numTurns: 0, isError: false })
  })
})
