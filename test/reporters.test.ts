import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CaseReport } from '../src/runner.js'
import { printReports } from '../src/reporters/terminal.js'

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

  test('stays quiet when under budget or uncapped', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    printReports([report(0.1)], 0.5)
    printReports([report(9.99)])
    const out = log.mock.calls.flat().join('\n')
    expect(out).not.toContain('exceeded')
  })
})
