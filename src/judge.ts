import { claudeCode } from './adapters/claude-code.js'
import type { Transcript } from './transcript.js'

export interface Verdict {
  score: number
  pass: boolean
  reasoning: string
}

export function summarize(t: Transcript): string {
  const parts: string[] = []
  if (t.messages.length) parts.push('assistant said:\n' + t.messages.join('\n---\n'))
  if (t.commands.length) parts.push('commands run:\n' + t.commands.join('\n'))
  const tools = t.toolCalls.map((c) => c.name).join(', ')
  if (tools) parts.push('tools used: ' + tools)
  return parts.join('\n\n') || '(empty transcript)'
}

export function parseVerdict(text: string, passScore: number): Verdict {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('judge returned no JSON')
  const parsed = JSON.parse(match[0])
  if (typeof parsed.score !== 'number') throw new Error('judge JSON has no numeric score')
  return {
    score: parsed.score,
    pass: parsed.score >= passScore,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  }
}

export async function judgeTranscript(opts: {
  rubric: string
  transcript: Transcript
  model?: string
  passScore?: number
}): Promise<Verdict> {
  const prompt = [
    'You are grading an AI agent transcript against a rubric.',
    'Rubric:',
    opts.rubric,
    '',
    'Transcript:',
    summarize(opts.transcript),
    '',
    'Reply with only a JSON object: {"score": <0-10>, "reasoning": "<one sentence>"}',
  ].join('\n')
  const passScore = opts.passScore ?? 7
  const attempt = async () => {
    const t = await claudeCode.run({
      prompt,
      cwd: process.cwd(),
      model: opts.model ?? 'haiku',
      maxTurns: 1,
      timeoutMs: 120_000,
    })
    return parseVerdict(t.messages.join('\n'), passScore)
  }
  try {
    return await attempt()
  } catch {
    return await attempt()
  }
}
