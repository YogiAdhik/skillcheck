import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import type { Adapter, RunOptions } from '../src/adapters/types.js'
import { judgeTranscript, parseVerdict, summarize } from '../src/judge.js'
import type { Transcript } from '../src/transcript.js'

describe('judge', () => {
  test('parseVerdict pulls JSON out of chatter', () => {
    const v = parseVerdict('Sure! Here is my grade:\n{"score": 8, "reasoning": "did the job"}', 7)
    expect(v.score).toBe(8)
    expect(v.pass).toBe(true)
    expect(v.reasoning).toBe('did the job')
  })

  test('parseVerdict respects the pass threshold', () => {
    expect(parseVerdict('{"score": 6, "reasoning": "meh"}', 7).pass).toBe(false)
  })

  test('parseVerdict throws on garbage', () => {
    expect(() => parseVerdict('no json here', 7)).toThrow()
    expect(() => parseVerdict('{"reasoning": "no score"}', 7)).toThrow()
  })

  test('parseVerdict survives braces in surrounding chatter', () => {
    const v = parseVerdict('the transcript had {cwd: stuff} in it\n{"score": 9, "reasoning": "solid"}\ndone {ok}', 7)
    expect(v.score).toBe(9)
    expect(v.pass).toBe(true)
  })

  test('parseVerdict clamps out-of-range scores', () => {
    expect(parseVerdict('{"score": 15, "reasoning": "x"}', 7).score).toBe(10)
    expect(parseVerdict('{"score": -3, "reasoning": "x"}', 7).score).toBe(0)
  })

  test('judgeTranscript runs bare in a scratch cwd and surfaces cost', async () => {
    let captured: RunOptions | undefined
    const fakeAdapter: Adapter = {
      name: 'fake',
      async run(opts) {
        captured = opts
        return {
          messages: ['{"score": 9, "reasoning": "ok"}'],
          toolCalls: [],
          commands: [],
          result: { costUsd: 0.02, numTurns: 1, isError: false },
        }
      },
    }
    const verdict = await judgeTranscript({
      rubric: 'be helpful',
      transcript: { messages: [], toolCalls: [], commands: [] },
      adapter: fakeAdapter,
    })
    expect(verdict.pass).toBe(true)
    expect(verdict.costUsd).toBe(0.02)
    expect(captured?.bare).toBe(true)
    expect(captured?.cwd).toBe(tmpdir())
    expect(captured?.maxTurns).toBe(1)
    expect(captured?.model).toBe('haiku')
  })

  test('summarize covers messages, commands, tools', () => {
    const t: Transcript = {
      messages: ['hello'],
      toolCalls: [{ name: 'Bash', input: { command: 'ls' } }],
      commands: ['ls'],
    }
    const s = summarize(t)
    expect(s).toContain('hello')
    expect(s).toContain('ls')
    expect(s).toContain('Bash')
  })
})
