import { createHash } from 'node:crypto'
import { cp, mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import type { WorkspaceDiff } from './expect.js'

const SKIP = new Set(['.git', '.claude', 'node_modules'])

async function walkFiles(root: string, dir = root): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walkFiles(root, p)))
    else out.push(p)
  }
  return out
}

export async function snapshot(dir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const file of await walkFiles(dir)) {
    const hash = createHash('sha1').update(await readFile(file)).digest('hex')
    map.set(relative(dir, file).split(sep).join('/'), hash)
  }
  return map
}

export async function makeWorkspace(opts: {
  fixture?: string
  skillDir: string
  skillName: string
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'skillcheck-'))
  if (opts.fixture) await cp(opts.fixture, dir, { recursive: true })
  await cp(opts.skillDir, join(dir, '.claude', 'skills', opts.skillName), { recursive: true })
  return dir
}

export async function diffWorkspace(dir: string, before: Map<string, string>): Promise<WorkspaceDiff> {
  const after = await snapshot(dir)
  const changed: string[] = []
  const created: string[] = []
  const deleted: string[] = []
  for (const [path, hash] of after) {
    if (!before.has(path)) created.push(path)
    else if (before.get(path) !== hash) changed.push(path)
  }
  for (const path of before.keys()) if (!after.has(path)) deleted.push(path)
  return { changed: changed.sort(), created: created.sort(), deleted: deleted.sort() }
}
