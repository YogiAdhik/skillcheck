import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function hashInputs(skillDir: string, caseYaml: string): string {
  const h = createHash('sha1').update(caseYaml).update('\0')
  const walk = (dir: string, prefix: string) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )
    for (const entry of entries) {
      const rel = prefix + entry.name
      if (entry.isDirectory()) {
        h.update('d\0' + rel + '\0')
        walk(join(dir, entry.name), rel + '/')
      } else {
        h.update('f\0' + rel + '\0').update(readFileSync(join(dir, entry.name))).update('\0')
      }
    }
  }
  walk(skillDir, '')
  return h.digest('hex')
}

export class ResultCache {
  private data: Record<string, unknown> = {}

  constructor(private path: string) {
    if (existsSync(path)) {
      try {
        this.data = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        this.data = {}
      }
    }
  }

  get(key: string): unknown {
    return this.data[key]
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.data, null, 2))
  }
}
