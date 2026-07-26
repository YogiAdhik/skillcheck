import { readFileSync, readdirSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import YAML from 'yaml'
import { claudeCode } from './adapters/claude-code.js'
import type { Adapter } from './adapters/types.js'
import { hashInputs, ResultCache } from './cache.js'
import { checkExpectations, type CheckResult, type Expectations } from './expect.js'
import { judgeTranscript, type Verdict } from './judge.js'
import { diffWorkspace, makeWorkspace, snapshot } from './workspace.js'

export interface TestCase {
  name: string
  prompt: string
  setup?: string
  expect?: Expectations
  judge?: string
  judge_pass?: number
}

export interface TestFile {
  path: string
  skill: string
  cases: TestCase[]
}

export interface CaseReport {
  file: string
  case: string
  checks: CheckResult[]
  verdict?: Verdict
  costUsd: number
  cached: boolean
  error?: string
}

export interface RunnerOptions {
  model?: string
  budgetUsd?: number
  timeoutMs?: number
  cache?: boolean
  adapter?: Adapter
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.skillcheck'])

export function discoverTestFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path]
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name))
      else if (entry.isFile() && entry.name.endsWith('.test.yaml')) found.push(join(dir, entry.name))
    }
  }
  walk(path)
  return found.sort()
}

export function loadTestFile(path: string): TestFile {
  const doc = YAML.parse(readFileSync(path, 'utf8'))
  if (!doc || typeof doc.skill !== 'string' || !Array.isArray(doc.cases))
    throw new Error(`${path}: needs a "skill" path and a "cases" list`)
  return { path, skill: doc.skill, cases: doc.cases }
}

function caseKey(skillDir: string, fileDir: string, c: TestCase, model?: string): string {
  return hashInputs(
    c.setup ? [skillDir, resolve(fileDir, c.setup)] : skillDir,
    YAML.stringify(c) + '\0' + (model ?? ''),
  )
}

export interface CasePlan {
  file: string
  case: string
  cached: boolean
  lastCostUsd?: number
}

export function planTests(root: string, opts: RunnerOptions = {}): CasePlan[] {
  const cache = new ResultCache(join(process.cwd(), '.skillcheck', 'cache.json'))
  const plans: CasePlan[] = []
  for (const file of discoverTestFiles(root)) {
    const testFile = loadTestFile(file)
    const skillDir = resolve(dirname(file), testFile.skill)
    for (const c of testFile.cases) {
      const hit = cache.get(caseKey(skillDir, dirname(file), c, opts.model)) as
        | CaseReport
        | undefined
      plans.push({ file, case: c.name, cached: !!hit, lastCostUsd: hit?.costUsd })
    }
  }
  return plans
}

export async function runTests(root: string, opts: RunnerOptions = {}): Promise<CaseReport[]> {
  const adapter = opts.adapter ?? claudeCode
  const cache = new ResultCache(join(process.cwd(), '.skillcheck', 'cache.json'))
  const reports: CaseReport[] = []
  let spent = 0

  for (const file of discoverTestFiles(root)) {
    const testFile = loadTestFile(file)
    const skillDir = resolve(dirname(file), testFile.skill)

    for (const c of testFile.cases) {
      if (opts.budgetUsd !== undefined && spent >= opts.budgetUsd) {
        reports.push({
          file,
          case: c.name,
          checks: [],
          costUsd: 0,
          cached: false,
          error: `budget of $${opts.budgetUsd} reached before this case`,
        })
        continue
      }

      const key = caseKey(skillDir, dirname(file), c, opts.model)
      if (opts.cache !== false) {
        const hit = cache.get(key) as CaseReport | undefined
        if (hit) {
          reports.push({ ...hit, cached: true })
          continue
        }
      }

      let ws: string | undefined
      try {
        ws = await makeWorkspace({
          fixture: c.setup ? resolve(dirname(file), c.setup) : undefined,
          skillDir,
          skillName: basename(skillDir),
        })
        const before = await snapshot(ws)
        const transcript = await adapter.run({
          prompt: c.prompt,
          cwd: ws,
          model: opts.model,
          timeoutMs: opts.timeoutMs,
        })
        const diff = await diffWorkspace(ws, before)
        const checks = c.expect ? checkExpectations(c.expect, transcript, diff) : []
        let verdict: Verdict | undefined
        if (c.judge)
          verdict = await judgeTranscript({
            rubric: c.judge,
            transcript,
            model: opts.model,
            passScore: c.judge_pass,
            adapter,
          })
        const judgeCost = verdict?.costUsd ?? 0
        const costUsd = (transcript.result?.costUsd ?? 0) + judgeCost
        spent += costUsd
        const report: CaseReport = { file, case: c.name, checks, verdict, costUsd, cached: false }
        reports.push(report)
        if (opts.cache !== false) {
          try {
            cache.set(key, report)
          } catch {
            // a failed cache write must not fail the case
          }
        }
      } catch (e) {
        reports.push({
          file,
          case: c.name,
          checks: [],
          costUsd: 0,
          cached: false,
          error: (e as Error).message,
        })
      } finally {
        if (ws) await rm(ws, { recursive: true, force: true })
      }
    }
  }
  return reports
}

export function reportsPass(reports: CaseReport[]): boolean {
  return reports.every(
    (r) => !r.error && r.checks.every((c) => c.pass) && (r.verdict?.pass ?? true),
  )
}
