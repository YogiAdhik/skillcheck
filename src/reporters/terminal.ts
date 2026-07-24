import pc from 'picocolors'
import type { Finding } from '../lint/rules.js'
import type { CaseReport } from '../runner.js'

export function printFindings(findings: Finding[]): void {
  for (const f of findings) {
    const tag = f.severity === 'error' ? pc.red('error') : pc.yellow('warn ')
    console.log(`${tag} ${f.file} [${f.rule}] ${f.message}`)
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  console.log(`\n${findings.length} finding(s), ${errors} error(s)`)
}

export function printReports(reports: CaseReport[]): void {
  let cost = 0
  for (const r of reports) {
    cost += r.costUsd
    const failed = r.checks.filter((c) => !c.pass)
    const ok = !r.error && failed.length === 0 && (r.verdict?.pass ?? true)
    const mark = ok ? pc.green('pass') : pc.red('fail')
    const cached = r.cached ? pc.dim(' (cached)') : ''
    console.log(`${mark} ${r.case}${cached}`)
    if (r.error) console.log(pc.red(`     ${r.error}`))
    for (const c of failed) console.log(pc.red(`     ${c.name}: ${c.detail}`))
    if (r.verdict && !r.verdict.pass)
      console.log(pc.red(`     judge: ${r.verdict.score}/10 — ${r.verdict.reasoning}`))
  }
  console.log(`\n${reports.length} case(s), $${cost.toFixed(4)} spent`)
}
