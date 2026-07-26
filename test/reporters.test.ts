import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CasePlan, CaseReport } from '../src/runner.js'
import { printPlan, printReports } from '../src/reporters/terminal.js'

function report(costUsd: number): CaseReport {
  return { file: 'x.test.yaml', case: 'a case', checks: [], costUsd, cached: false }
}

describe('printReports', () => {
  afterEach(() => vi.restoreAllMocks())

  test('warns when spend exceeds the budget', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    printReports([report(2.18)], 0.5)
    const out = log.mock.calls.flat().join('\n')
    expect(out).toContain('budget of $0.5 exceeded')
    expect(out).toContain('overshoot')
  })

  test('plan output separates live from cached', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const plans: CasePlan[] = [
      { file: 'a.test.yaml', case: 'fresh case', cached: false },
      { file: 'a.test.yaml', case: 'seen case', cached: true, lastCostUsd: 0.07 },
    ]
    printPlan(plans)
    const out = log.mock.calls.flat().join('\n')
    expect(out).toContain('would run fresh case')
    expect(out).toContain('seen case')
    expect(out).toContain('1 would run live, 1 would replay from cache')
    expect(out).toContain('--model haiku')
  })

  test('stays quiet when under budget or uncapped', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    printReports([report(0.1)], 0.5)
    printReports([report(9.99)])
    const out = log.mock.calls.flat().join('\n')
    expect(out).not.toContain('exceeded')
  })
})
