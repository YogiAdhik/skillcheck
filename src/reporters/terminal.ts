import pc from 'picocolors'
import type { Finding } from '../lint/rules.js'

export function printFindings(findings: Finding[]): void {
  for (const f of findings) {
    const tag = f.severity === 'error' ? pc.red('error') : pc.yellow('warn ')
    console.log(`${tag} ${f.file} [${f.rule}] ${f.message}`)
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  console.log(`\n${findings.length} finding(s), ${errors} error(s)`)
}
