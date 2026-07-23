import type { Finding } from '../lint/rules.js'

export function printGithubAnnotations(findings: Finding[]): void {
  for (const f of findings) {
    const kind = f.severity === 'error' ? 'error' : 'warning'
    console.log(`::${kind} file=${f.file}::[${f.rule}] ${f.message}`)
  }
}
