#!/usr/bin/env node
import { Command } from 'commander'
import { lintPath } from './lint/lint.js'
import { printGithubAnnotations } from './reporters/github.js'
import { printFindings } from './reporters/terminal.js'

const program = new Command()

program
  .name('skillcheck')
  .description('lint and behavioral tests for agent skills')
  .version('0.1.0')

program
  .command('lint')
  .argument('[path]', 'skill file or directory', '.')
  .option('--json', 'machine-readable output')
  .option('--github', 'github actions annotations')
  .action((path: string, opts: { json?: boolean; github?: boolean }) => {
    const findings = lintPath(path)
    if (opts.json) console.log(JSON.stringify(findings, null, 2))
    else if (opts.github) printGithubAnnotations(findings)
    else printFindings(findings)
    process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0
  })

program.parseAsync()
