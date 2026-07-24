import { tmpdir } from 'node:os'
import { claudeCode } from './adapters/claude-code.js'
import type { Adapter } from './adapters/types.js'
import type { Transcript } from './transcript.js'

export interface Verdict {
  score: number
  pass: boolean
  reasoning: string
  costUsd?: number
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
  const candidates = [...text.matchAll(/\{[\s\S]*?\}/g), ...(text.match(/\{[\s\S]*\}/) ? [[text.match(/\{[\s\S]*\}/)![0]]] : [])]
  for (const m of candidates) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[0])
    } catch {
      continue
    }
    const score = (parsed as { score?: unknown }).score
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    const clamped = Math.min(10, Math.max(0, score))
    const reasoning = (parsed as { reasoning?: unknown }).reasoning
    return {
      score: clamped,
      pass: clamped >= passScore,
      reasoning: typeof reasoning === 'string' ? reasoning : '',
    }
  }
  throw new Error('judge returned no JSON verdict')
}

export async function judgeTranscript(opts: {
  rubric: string
  transcript: Transcript
  model?: string
  passScore?: number
  adapter?: Adapter
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
  const adapter = opts.adapter ?? claudeCode
  let costUsd = 0
  const attempt = async () => {
    const t = await adapter.run({
      prompt,
      cwd: tmpdir(),
      bare: true,
      model: opts.model ?? 'haiku',
      maxTurns: 1,
      timeoutMs: 120_000,
    })
    costUsd += t.result?.costUsd ?? 0
    return parseVerdict(t.messages.join('\n'), passScore)
  }
  let verdict: Verdict
  try {
    verdict = await attempt()
  } catch {
    verdict = await attempt()
  }
  return { ...verdict, costUsd }
}
