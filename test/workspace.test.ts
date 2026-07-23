import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { diffWorkspace, makeWorkspace, snapshot } from '../src/workspace.js'

let fixture: string
let ws: string | undefined

beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'skillcheck-fixture-'))
  await writeFile(join(fixture, 'a.txt'), 'original')
  await mkdir(join(fixture, 'sub'))
  await writeFile(join(fixture, 'sub', 'b.txt'), 'nested')
})

afterEach(async () => {
  await rm(fixture, { recursive: true, force: true })
  if (ws) await rm(ws, { recursive: true, force: true })
})

describe('workspace', () => {
  test('copies fixture and mounts the skill', async () => {
    ws = await makeWorkspace({
      fixture,
      skillDir: 'test/fixtures/good-skill',
      skillName: 'good-skill',
    })
    expect(existsSync(join(ws, 'a.txt'))).toBe(true)
    expect(existsSync(join(ws, '.claude', 'skills', 'good-skill', 'SKILL.md'))).toBe(true)
  })

  test('diff sees changes, creations, deletions; ignores .claude', async () => {
    ws = await makeWorkspace({
      fixture,
      skillDir: 'test/fixtures/good-skill',
      skillName: 'good-skill',
    })
    const before = await snapshot(ws)
    await writeFile(join(ws, 'a.txt'), 'edited')
    await writeFile(join(ws, 'new.txt'), 'fresh')
    await rm(join(ws, 'sub', 'b.txt'))
    const diff = await diffWorkspace(ws, before)
    expect(diff.changed).toEqual(['a.txt'])
    expect(diff.created).toEqual(['new.txt'])
    expect(diff.deleted).toEqual(['sub/b.txt'])
  })
})
