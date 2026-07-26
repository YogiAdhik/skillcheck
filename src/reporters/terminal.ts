import pc from 'picocolors'
import type { Finding } from '../lint/rules.js'
import type { CasePlan, CaseReport } from '../runner.js'

export function printFindings(findings: Finding[]): void {
  for (const f of findings) {
    const tag = f.severity === 'error' ? pc.red('error') : pc.yellow('warn ')
    console.log(`${tag} ${f.file} [${f.rule}] ${f.message}`)
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  console.log(`\n${findings.length} finding(s), ${errors} error(s)`)
}

export function printPlan(plans: CasePlan[]): void {
  let live = 0
  let knownCost = 0
  for (const p of plans) {
    if (p.cached) {
      knownCost += p.lastCostUsd ?? 0
      console.log(`${pc.dim('cached   ')} ${p.case} ($${(p.lastCostUsd ?? 0).toFixed(4)} last time, replays free)`)
    } else {
      live++
      console.log(`${pc.yellow('would run')} ${p.case}`)
    }
  }
  console.log(`\n${plans.length} case(s): ${live} would run live, ${plans.length - live} would replay from cache`)
  if (live > 0)
    console.log(
      pc.yellow(
        `live cases cost real money and their price is unknown until they run — pair --model haiku with --budget`,
      ),
    )
  else if (plans.length > 0)
    console.log(pc.dim(`nothing to spend — a real run would replay entirely from cache ($${knownCost.toFixed(4)} when first run)`))
}

export function printReports(reports: CaseReport[], budgetUsd?: number): void {
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
  if (budgetUsd !== undefined && cost > budgetUsd)
    console.log(
      pc.yellow(
        `budget of $${budgetUsd} exceeded — the cap is checked between cases, so a single case can overshoot it`,
      ),
    )
}
