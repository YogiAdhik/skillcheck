#!/usr/bin/env node
import { Command } from 'commander'
import { initTestFile } from './init.js'
import { lintPath } from './lint/lint.js'
import { printGithubAnnotations } from './reporters/github.js'
import { printFindings, printPlan, printReports } from './reporters/terminal.js'
import { discoverTestFiles, planTests, reportsPass, runTests } from './runner.js'

const program = new Command()

program
  .name('skillcheck')
  .description('lint and behavioral tests for agent skills')
  .version('0.2.0')

program
  .command('lint')
  .argument('[path]', 'skill file or directory', '.')
  .option('--json', 'machine-readable output')
  .option('--github', 'github actions annotations')
  .action((path: string, opts: { json?: boolean; github?: boolean }) => {
    try {
      const findings = lintPath(path)
      if (opts.json) console.log(JSON.stringify(findings, null, 2))
      else if (opts.github) printGithubAnnotations(findings)
      else printFindings(findings)
      process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0
    } catch (e) {
      console.error((e as Error).message)
      process.exitCode = 1
      return
    }
  })

program
  .command('run')
  .argument('[path]', 'directory with *.test.yaml files', '.')
  .option('--model <model>', 'model passed through to the agent')
  .option('--budget <usd>', 'stop once this much has been spent')
  .option('--timeout <seconds>', 'per-case timeout', '300')
  .option('--no-cache', 'ignore and do not write cached results')
  .option('--dry-run', 'show what would run and what would replay from cache, spending nothing')
  .option('--json', 'machine-readable output')
  .action(async (path: string, opts) => {
    try {
      if (opts.dryRun) {
        const plans = planTests(path, { model: opts.model })
        if (opts.json) console.log(JSON.stringify(plans, null, 2))
        else printPlan(plans)
        return
      }
      const files = discoverTestFiles(path)
      if (!opts.json) {
        console.log(`${files.length} test file(s); live agent runs cost money — cap with --budget`)
        if (!opts.model)
          console.log('no --model given — using the CLI default model; pass --model haiku for cheap runs')
      }
      const budgetUsd = opts.budget ? Number(opts.budget) : undefined
      const reports = await runTests(path, {
        model: opts.model,
        budgetUsd,
        timeoutMs: Number(opts.timeout) * 1000,
        cache: opts.cache,
      })
      if (opts.json) console.log(JSON.stringify(reports, null, 2))
      else printReports(reports, budgetUsd)
      process.exitCode = reportsPass(reports) ? 0 : 1
    } catch (e) {
      console.error((e as Error).message)
      process.exitCode = 1
    }
  })

program
  .command('init')
  .argument('<skillDir>', 'skill directory to scaffold tests for')
  .action((skillDir: string) => {
    try {
      console.log(`wrote ${initTestFile(skillDir)}`)
    } catch (e) {
      console.error((e as Error).message)
      process.exitCode = 1
    }
  })

program.parseAsync()
