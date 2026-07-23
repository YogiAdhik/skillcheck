import type { Transcript } from './transcript.js'

export interface WorkspaceDiff {
  changed: string[]
  created: string[]
  deleted: string[]
}

export interface Expectations {
  files_changed?: string[]
  command_ran?: string
  transcript_matches?: string
  skill_invoked?: boolean
}

export interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

export function checkExpectations(
  exp: Expectations,
  transcript: Transcript,
  diff: WorkspaceDiff,
): CheckResult[] {
  const out: CheckResult[] = []

  if (exp.files_changed !== undefined) {
    const actual = [...diff.changed, ...diff.created, ...diff.deleted].sort()
    const wanted = [...exp.files_changed].sort()
    const pass = actual.length === wanted.length && actual.every((v, i) => v === wanted[i])
    out.push({
      name: 'files_changed',
      pass,
      detail: pass ? 'ok' : `expected [${wanted.join(', ')}] got [${actual.join(', ')}]`,
    })
  }

  if (exp.command_ran !== undefined) {
    const pass = transcript.commands.some((c) => c.includes(exp.command_ran!))
    out.push({
      name: 'command_ran',
      pass,
      detail: pass
        ? 'ok'
        : `no command containing "${exp.command_ran}" (ran: ${transcript.commands.join(' ; ') || 'none'})`,
    })
  }

  if (exp.transcript_matches !== undefined) {
    let pass = false
    let detail: string
    try {
      const re = new RegExp(exp.transcript_matches, 'm')
      const haystack = [...transcript.messages, ...transcript.commands].join('\n')
      pass = re.test(haystack)
      detail = pass ? 'ok' : `nothing in the transcript matches /${exp.transcript_matches}/`
    } catch {
      detail = `invalid regex: ${exp.transcript_matches}`
    }
    out.push({ name: 'transcript_matches', pass, detail })
  }

  if (exp.skill_invoked !== undefined) {
    const invoked = transcript.toolCalls.some((c) => c.name === 'Skill')
    const pass = invoked === exp.skill_invoked
    out.push({
      name: 'skill_invoked',
      pass,
      detail: pass ? 'ok' : invoked ? 'skill fired but was expected not to' : 'skill never fired',
    })
  }

  return out
}
